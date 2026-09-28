import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import shp from "shpjs";

const DATA_FILE = resolve(process.cwd(), "assets", "larimer-county-building-footprint-shp.zip");
const FETCH_LIMIT = 1000;

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
}

export interface BuildingFootprintsCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: Record<string, never>; geometry: PolygonGeometry }[];
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
      features.push({ type: "Feature", properties: {}, geometry: footprint.geometry });
      if (features.length === FETCH_LIMIT) {
        break;
      }
    }
  }

  return { type: "FeatureCollection", features };
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

export const fetchBuildingFootprints = async (bbox: BBox): Promise<BuildingFootprintsCollection> => {
  return filterFootprintsByBBox(await getFootprints(), bbox);
};
