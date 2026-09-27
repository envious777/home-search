import Extent from "@arcgis/core/geometry/Extent";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D";
import type { BuildingInfo, SelectedLocation } from "../../types";
import {
  AVG_STORY_HEIGHT_FT,
  BUILDING_FOOTPRINTS_API_URL,
  FEET_PER_DEGREE_LATITUDE,
  FEET_TO_METERS,
  FOOTPRINT_ASPECT_RATIO,
  imageryYears,
  IMAGERY_ROOT,
  IMAGERY_SERVICES_BY_YEAR,
  LARIMER_COUNTY_BOUNDS,
  MAP_PIN_OUTLINE,
  MAP_PIN_PATH,
  SUN_DATES,
} from "./constants";

export const larimerCountyExtent = new Extent({
  ...LARIMER_COUNTY_BOUNDS,
  spatialReference: { wkid: 4326 },
});

export const imageryForYear = (year: number): { year: number; url: string } => {
  const imageryYear = [...imageryYears].reverse().find((candidate) => candidate <= year) ?? imageryYears[0];
  return { year: imageryYear, url: `${IMAGERY_ROOT}/${IMAGERY_SERVICES_BY_YEAR[imageryYear]}/MapServer` };
}

export const sunDate = (sunDateId: string, hour: number): Date => {
  const option = SUN_DATES.find((candidate) => candidate.id === sunDateId);
  const date = new Date();
  if (option?.month !== undefined && option.day !== undefined) {
    date.setMonth(option.month, option.day);
  }
  date.setHours(hour, 0, 0, 0);
  return date;
}

const pinImage = (color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${MAP_PIN_PATH}" fill="${color}" stroke="${MAP_PIN_OUTLINE}" stroke-width="1"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const pinSymbol = (color: string, size: number, isScene: boolean) => {
  return isScene
    ? new PointSymbol3D({
        symbolLayers: [new IconSymbol3DLayer({ resource: { href: pinImage(color) }, anchor: "bottom", size })],
      })
    : {
        type: "simple-marker" as const,
        style: "path" as const,
        path: MAP_PIN_PATH,
        color,
        size,
        yoffset: size / 2,
        outline: { color: MAP_PIN_OUTLINE, width: 1 },
      };
}

export const buildingFootprint = (selected: Pick<SelectedLocation, "latitude" | "longitude">, buildingInfo: BuildingInfo) => {
  const footprintSqFt = buildingInfo.squareFeet / buildingInfo.stories;
  const widthFt = Math.sqrt(footprintSqFt * FOOTPRINT_ASPECT_RATIO);
  const depthFt = footprintSqFt / widthFt;
  const latitudeRadians = (selected.latitude * Math.PI) / 180;
  const feetPerDegreeLongitude = FEET_PER_DEGREE_LATITUDE * Math.cos(latitudeRadians);
  const halfWidthDegrees = widthFt / feetPerDegreeLongitude / 2;
  const halfDepthDegrees = depthFt / FEET_PER_DEGREE_LATITUDE / 2;
  return new Polygon({
    rings: [
      [
        [selected.longitude - halfWidthDegrees, selected.latitude - halfDepthDegrees],
        [selected.longitude + halfWidthDegrees, selected.latitude - halfDepthDegrees],
        [selected.longitude + halfWidthDegrees, selected.latitude + halfDepthDegrees],
        [selected.longitude - halfWidthDegrees, selected.latitude + halfDepthDegrees],
        [selected.longitude - halfWidthDegrees, selected.latitude - halfDepthDegrees],
      ],
    ],
    spatialReference: { wkid: 4326 },
  });
}

export const buildingHeightMeters = (buildingInfo: BuildingInfo): number => {
  return buildingInfo.stories * AVG_STORY_HEIGHT_FT * FEET_TO_METERS;
}

interface GeoJsonPolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export const geojsonToPolygon = (geometry: GeoJsonPolygonGeometry): Polygon => {
  // Esri Polygon.rings accepts multiple exterior rings directly (multipart), so MultiPolygon parts can be flattened.
  const rings =
    geometry.type === "MultiPolygon"
      ? (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon)
      : (geometry.coordinates as number[][][]);
  return new Polygon({ rings, spatialReference: { wkid: 4326 } });
}

export const fetchBuildingFootprints = async (extent: Extent): Promise<Polygon[]> => {
  const params = new URLSearchParams({
    xmin: String(extent.xmin),
    ymin: String(extent.ymin),
    xmax: String(extent.xmax),
    ymax: String(extent.ymax),
  });
  const response = await fetch(`${BUILDING_FOOTPRINTS_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Building footprint request failed (${response.status})`);
  }
  const collection = await response.json();
  const features: { geometry: GeoJsonPolygonGeometry | null }[] = collection.features ?? [];
  return features.filter((feature) => feature.geometry).map((feature) => geojsonToPolygon(feature.geometry!));
}

export const findFootprintAtPoint = (footprints: Polygon[], point: Point): Polygon | null => {
  return footprints.find((footprint) => geometryEngine.contains(footprint, point)) ?? null;
}
