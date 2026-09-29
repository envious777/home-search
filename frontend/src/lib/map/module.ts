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
  MAX_SHADOW_BRIGHTNESS,
  MAX_SHADOW_CONTRAST,
  MAX_SHADOW_IMAGERY_OPACITY,
  MIN_SHADOW_BRIGHTNESS,
  MIN_SHADOW_CONTRAST,
  MIN_SHADOW_IMAGERY_OPACITY,
  SUN_DATES,
} from "./constants";
import { apiBase } from "../global";

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

export const shadowDisplayForDate = (date: Date): { brightness: number; contrast: number; imageryOpacity: number } => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  const latitudeRadians = (40.5853 * Math.PI) / 180;
  const declinationRadians =
    ((-23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365)) * Math.PI) / 180;
  const hourAngleRadians = ((15 * (date.getHours() - 12)) * Math.PI) / 180;
  const altitude = Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declinationRadians) +
      Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngleRadians),
  );
  const intensity = Math.max(0, Math.min(1, Math.sin(altitude)));

  return {
    brightness: MAX_SHADOW_BRIGHTNESS - intensity * (MAX_SHADOW_BRIGHTNESS - MIN_SHADOW_BRIGHTNESS),
    contrast: MIN_SHADOW_CONTRAST + intensity * (MAX_SHADOW_CONTRAST - MIN_SHADOW_CONTRAST),
    imageryOpacity:
      MAX_SHADOW_IMAGERY_OPACITY - intensity * (MAX_SHADOW_IMAGERY_OPACITY - MIN_SHADOW_IMAGERY_OPACITY),
  };
};

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

export interface BuildingFootprint {
  geometry: Polygon;
  heightMeters: number | null;
}

export const geojsonToPolygon = (geometry: GeoJsonPolygonGeometry): Polygon => {
  // Esri Polygon.rings accepts multiple exterior rings directly (multipart), so MultiPolygon parts can be flattened.
  const rings =
    geometry.type === "MultiPolygon"
      ? (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon)
      : (geometry.coordinates as number[][][]);
  return new Polygon({ rings, spatialReference: { wkid: 4326 } });
}

export const fetchBuildingFootprints = async (extent: Extent): Promise<BuildingFootprint[]> => {
  const params = new URLSearchParams({
    xmin: String(extent.xmin),
    ymin: String(extent.ymin),
    xmax: String(extent.xmax),
    ymax: String(extent.ymax),
  });
  const response = await fetch(`${apiBase}/building-footprints?${params}`);
  if (!response.ok) {
    throw new Error(`Building footprint request failed (${response.status})`);
  }
  const collection = await response.json();
  const features: { geometry: GeoJsonPolygonGeometry | null; properties?: { stories?: number } }[] = collection.features ?? [];
  return features
    .filter((feature) => feature.geometry)
    .map((feature) => ({
      geometry: geojsonToPolygon(feature.geometry!),
      heightMeters:
        typeof feature.properties?.stories === "number"
          ? feature.properties.stories * AVG_STORY_HEIGHT_FT * FEET_TO_METERS
          : null,
    }));
}

export const findFootprintAtPoint = (footprints: BuildingFootprint[], point: Point): BuildingFootprint | null => {
  return footprints.find((footprint) => geometryEngine.contains(footprint.geometry, point)) ?? null;
}
