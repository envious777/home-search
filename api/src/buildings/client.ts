import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import shp from "shpjs";
import { sectionUrl } from "../assessor/endpoints.js";
import { InvocationContext } from "@azure/functions";

const DATA_FILE = resolve(process.cwd(), "assets", "larimer-county-building-footprint-shp.zip");
const FETCH_LIMIT = 1000;
const PARCELS_URL = "https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3/query";
const ASSESSOR_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 8000;

export interface BBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface PolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface IndexedFootprint {
  geometry: PolygonGeometry;
  bounds: BBox;
  stories?: number;
}

export interface BuildingFootprintsCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { stories?: number }; geometry: PolygonGeometry }[];
}

interface ParcelGeometry {
  rings: unknown;
}

interface ParcelRecord {
  geometry: ParcelGeometry;
  accountno: string;
  bounds: BBox;
}

export const geometryBounds = (geometry: PolygonGeometry): BBox | null => {
  const bounds = { xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity };
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) {
      return;
    }
    const [longitude, latitude] = coordinates;
    if (typeof longitude === "number" && typeof latitude === "number") {
      bounds.xmin = Math.min(bounds.xmin, longitude);
      bounds.ymin = Math.min(bounds.ymin, latitude);
      bounds.xmax = Math.max(bounds.xmax, longitude);
      bounds.ymax = Math.max(bounds.ymax, latitude);
      return;
    }
    coordinates.forEach(visit);
  };

  visit(geometry.coordinates);
  return Number.isFinite(bounds.xmin) ? bounds : null;
};

export const filterFootprintsByBBox = (
  footprints: IndexedFootprint[],
  bbox: BBox,
): BuildingFootprintsCollection => {
  const features: BuildingFootprintsCollection["features"] = [];
  for (const footprint of footprints) {
    if (
      footprint.bounds.xmin <= bbox.xmax &&
      footprint.bounds.xmax >= bbox.xmin &&
      footprint.bounds.ymin <= bbox.ymax &&
      footprint.bounds.ymax >= bbox.ymin
    ) {
      features.push({
        type: "Feature",
        properties: footprint.stories === undefined ? {} : { stories: footprint.stories },
        geometry: footprint.geometry,
      });
      if (features.length === FETCH_LIMIT) {
        break;
      }
    }
  }

  return { type: "FeatureCollection", features };
};

const fetchJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Upstream request failed (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const readParcelRecords = (payload: unknown): ParcelRecord[] => {
  const features = asRecord(payload)?.features;

  if (!Array.isArray(features)) {
    return [];
  }

  return features.flatMap((feature) => {
    const record = asRecord(feature);
    const attributes = asRecord(record?.attributes);
    const geometry = asRecord(record?.geometry);
    const schedule = attributes?.SCHEDNUM;
    if (!geometry || typeof geometry.rings === "undefined" || schedule === null || schedule === undefined) {
      return [];
    }
    const parcelGeometry = { rings: geometry.rings };
    const bounds = geometryBounds({ type: "Polygon", coordinates: parcelGeometry.rings });
    return bounds ? [{ geometry: parcelGeometry, accountno: `R${String(schedule)}`, bounds }] : [];
  });
};

const readStories = (payload: unknown): number | undefined => {
  const records = asRecord(payload)?.records;
  if (!Array.isArray(records)) {
    return undefined;
  }
  const stories = records
    .map((record) => Number(asRecord(record)?.stories))
    .find((value) => Number.isFinite(value) && value > 0);
  return stories;
};

const pointInRing = (longitude: number, latitude: number, ring: unknown): boolean => {
  if (!Array.isArray(ring)) {
    return false;
  }
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = Array.isArray(ring[index]) ? ring[index] : [];
    const previousPoint = Array.isArray(ring[previous]) ? ring[previous] : [];
    const currentLongitude = Number(currentPoint[0]);
    const currentLatitude = Number(currentPoint[1]);
    const previousLongitude = Number(previousPoint[0]);
    const previousLatitude = Number(previousPoint[1]);
    if (![currentLongitude, currentLatitude, previousLongitude, previousLatitude].every(Number.isFinite)) {
      continue;
    }
    const crosses = currentLatitude > latitude !== previousLatitude > latitude;
    if (crosses && longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
      (previousLatitude - currentLatitude) + currentLongitude) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInParcel = (longitude: number, latitude: number, geometry: ParcelGeometry): boolean => {
  if (!Array.isArray(geometry.rings)) {
    return false;
  }
  return geometry.rings.filter(Array.isArray).reduce((inside, ring) => pointInRing(longitude, latitude, ring) !== inside, false);
};

const representativeCoordinate = (coordinates: unknown): [number, number] | null => {
  const points: [number, number][] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) {
      return;
    }
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      points.push([longitude, latitude]);
      return;
    }
    value.forEach(collect);
  };

  collect(coordinates);
  if (!points.length) {
    return null;
  }
  return [
    points.reduce((sum, [longitude]) => sum + longitude, 0) / points.length,
    points.reduce((sum, [, latitude]) => sum + latitude, 0) / points.length,
  ];
};

const queryParcels = async (bbox: BBox): Promise<ParcelRecord[]> => {
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "PARCELNUM,LOCADDRESS,ACCTTYPE,SCHEDNUM",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(FETCH_LIMIT),
  });
  return readParcelRecords(await fetchJson(`${PARCELS_URL}?${params}`));
};

const loadStoriesByAccount = async (accounts: string[]): Promise<Map<string, number>> => {
  const storiesByAccount = new Map<string, number>();
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < accounts.length) {
      const account = accounts[nextIndex++];
      try {
        const stories = readStories(await fetchJson(sectionUrl("improvement", account, "")));
        if (stories !== undefined) {
          storiesByAccount.set(account, stories);
        }
      } catch {
        // A missing or unavailable improvement record should not hide all nearby footprints.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ASSESSOR_CONCURRENCY, accounts.length) }, worker));
  return storiesByAccount;
};

const enrichStories = async (footprints: IndexedFootprint[], bbox: BBox, context?: InvocationContext): Promise<void> => {
  const parcels = await queryParcels(bbox);
  context?.log?.("Queried parcel layer", { parcelCount: parcels.length, footprintCount: footprints.length });

  const accounts = [...new Set(parcels.map((parcel) => parcel.accountno))];
  const storiesByAccount = await loadStoriesByAccount(accounts);
  let matchedCount = 0;

  for (const footprint of footprints) {
    const coordinate = representativeCoordinate(footprint.geometry.coordinates);
    if (!coordinate) {
      continue;
    }
    const parcel = parcels.find(
      ({ geometry, bounds }) =>
        pointInParcel(coordinate[0], coordinate[1], geometry) ||
        (footprint.bounds.xmin <= bounds.xmax &&
          footprint.bounds.xmax >= bounds.xmin &&
          footprint.bounds.ymin <= bounds.ymax &&
          footprint.bounds.ymax >= bounds.ymin),
    );
    const stories = parcel ? storiesByAccount.get(parcel.accountno) : undefined;
    if (stories !== undefined) {
      footprint.stories = stories;
      matchedCount += 1;
    }
  }
  context?.log?.("Enriched building footprints", {
    accountCount: accounts.length,
    storyAccountCount: storiesByAccount.size,
    matchedCount,
  });
};

const isFeatureCollection = (value: unknown): value is { type: "FeatureCollection"; features: unknown[] } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  );
};

const loadFootprints = async (): Promise<IndexedFootprint[]> => {
  const parsed = await shp(await readFile(DATA_FILE));
  if (!isFeatureCollection(parsed)) {
    throw new Error("Building footprint archive did not contain a GeoJSON FeatureCollection.");
  }

  const footprints: IndexedFootprint[] = [];
  for (const feature of parsed.features) {
    if (typeof feature !== "object" || feature === null || !("geometry" in feature)) {
      continue;
    }
    const geometry = feature.geometry;
    if (
      typeof geometry !== "object" ||
      geometry === null ||
      !("type" in geometry) ||
      !("coordinates" in geometry) ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    ) {
      continue;
    }
    const polygonGeometry: PolygonGeometry = { type: geometry.type, coordinates: geometry.coordinates };
    const bounds = geometryBounds(polygonGeometry);
    if (bounds) {
      footprints.push({ geometry: polygonGeometry, bounds });
    }
  }
  return footprints;
};

let footprintsPromise: Promise<IndexedFootprint[]> | undefined;

const getFootprints = (): Promise<IndexedFootprint[]> => {
  if (!footprintsPromise) {
    footprintsPromise = loadFootprints().catch((error: unknown) => {
      footprintsPromise = undefined;
      throw error;
    });
  }
  return footprintsPromise;
};

export const fetchBuildingFootprints = async (bbox: BBox, context?: InvocationContext): Promise<BuildingFootprintsCollection> => {
  const footprints = (await getFootprints()).filter(
    (footprint) =>
      footprint.bounds.xmin <= bbox.xmax &&
      footprint.bounds.xmax >= bbox.xmin &&
      footprint.bounds.ymin <= bbox.ymax &&
      footprint.bounds.ymax >= bbox.ymin,
  );

  await enrichStories(footprints, bbox, context);

  return filterFootprintsByBBox(footprints, bbox);
};
