import Extent from "@arcgis/core/geometry/Extent";
import Mesh from "@arcgis/core/geometry/Mesh";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D";
import type { BuildingInfo, SelectedLocation } from "../../types";
import {
  AVG_STORY_HEIGHT_FT,
  BUILDING_COLOR,
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

const MILLISECONDS_PER_DAY = 86_400_000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const OBLIQUITY_DEGREES = 23.44;
const DAYS_PER_YEAR = 365;
const SOLSTICE_OFFSET_DAYS = 10;
const SUN_ANGLE_DEGREES_PER_HOUR = 15;
const NOON_HOUR = 12;

/**
 * Calculates the shadow display settings for a given date.
 * @param date The date for which to calculate shadow display settings.
 * @param latitude The selected address latitude in degrees.
 * @returns An object containing the brightness, contrast, and imagery opacity settings for shadows.
 */
export const shadowDisplayForDate = (
  date: Date,
  latitude: number,
): { brightness: number; contrast: number; imageryOpacity: number } => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / MILLISECONDS_PER_DAY);
  
  const latitudeRadians = latitude * DEGREES_TO_RADIANS;
  
  // Solar angle in radians based on the day of the year and solstice offset
  const solarAngle = (2 * Math.PI * (dayOfYear + SOLSTICE_OFFSET_DAYS)) / DAYS_PER_YEAR;

  // Declination of the sun in radians based on the solar angle
  const declinationRadians = (-OBLIQUITY_DEGREES * Math.cos(solarAngle)) * DEGREES_TO_RADIANS;
  
  // Hour angle of the sun in radians based on the current time of day
  const hourAngleRadians = (SUN_ANGLE_DEGREES_PER_HOUR * (date.getHours() - NOON_HOUR)) * DEGREES_TO_RADIANS;

  // Calculate the sun's altitude angle in radians
  const altitude = Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declinationRadians) + 
    Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngleRadians),
  ); 

  // Clamp the intensity between 0 and 1 based on the sun's altitude
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
  const latitudeRadians = selected.latitude * DEGREES_TO_RADIANS;
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

export const buildingRoof = (footprint: Polygon, height: number, rooftype: string | null, color = BUILDING_COLOR) => {
  const shape = rooftype?.trim().toLowerCase();
  if (!shape || !["gable", "gambrel", "hip", "hip/gable", "shed"].includes(shape)) return null;

  const ring = footprint.rings[0];
  // Validate that the footprint is a simple quadrilateral with the first and last points coinciding
  const invalidFootprint = footprint.rings.length !== 1 || ring.length !== 5 || ring[0][0] !== ring[4][0] || ring[0][1] !== ring[4][1];
  if (invalidFootprint) {
    return null;
  } 

  const corners = ring.slice(0, 4).map(([x, y]) => [x, y]);
  const latitude = corners.reduce((sum, corner) => sum + corner[1], 0) / 4;
  const xScale = FEET_PER_DEGREE_LATITUDE * Math.cos(latitude * DEGREES_TO_RADIANS) * FEET_TO_METERS;
  const yScale = FEET_PER_DEGREE_LATITUDE * FEET_TO_METERS;
  
  const edges = corners.map((corner, index) => {
    const next = corners[(index + 1) % 4];
    return [(next[0] - corner[0]) * xScale, (next[1] - corner[1]) * yScale];
  });

  const lengths = edges.map(([x, y]) => Math.hypot(x, y));
  const hasShortSide = lengths.some((length) => length < 2);
  const hasNonRightAngle = edges.some((edge, index) =>
    Math.abs(edge[0] * edges[(index + 1) % 4][0] + edge[1] * edges[(index + 1) % 4][1]) /
    (lengths[index] * lengths[(index + 1) % 4]) > 0.12);

  if (hasShortSide || hasNonRightAngle) {
    return null;
  }

  if (lengths[0] < lengths[1]) {
    corners.push(corners.shift()!);
  }

  const shortSide = Math.min(...lengths);
  const rise = Math.min(height * 0.3, shortSide * 0.23, 2.4);
  const eave = height - rise;
  const vertices: number[][] = corners.map(([x, y]) => [x, y, eave]);
  const faces: number[] = [];
  const addVertex = (first: number, second: number, fraction: number, z: number) => {
    const start = vertices[first];
    const end = vertices[second];
    vertices.push([start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction, z]);
    return vertices.length - 1;
  };

  const triangle = (first: number, second: number, third: number) => faces.push(first, second, third);
  const quad = (first: number, second: number, third: number, fourth: number) => {
    triangle(first, second, third);
    triangle(first, third, fourth);
  };

  if (shape === "shed") {
    const high0 = addVertex(0, 0, 0, height);
    const high1 = addVertex(1, 1, 0, height);
    quad(high0, high1, 2, 3);
    quad(0, 1, high1, high0);
    triangle(3, 0, high0);
    triangle(1, 2, high1);
  } else {
    const hip = shape === "hip" || shape === "hip/gable";
    
    // Create the main ridge vertices for the roof
    const ridge0 = addVertex(3, 0, 0.5, height);
    const ridge1 = addVertex(1, 2, 0.5, height);

    if (hip) {
      // Adjust the ridge vertices for hip roofs
      for (let index = 0; index < 2; index++) {
        vertices[ridge0][index] += (vertices[ridge1][index] - vertices[ridge0][index]) * 0.2;
        vertices[ridge1][index] -= (vertices[ridge1][index] - vertices[ridge0][index]) * 0.25;
      }
    }

    if (shape === "gambrel") {
      const breaks = [
        addVertex(3, 0, 0.25, eave + rise * 0.7), 
        addVertex(1, 2, 0.25, eave + rise * 0.7),
        addVertex(1, 2, 0.75, eave + rise * 0.7), 
        addVertex(3, 0, 0.75, eave + rise * 0.7)
      ];

      quad(0, 1, breaks[1], breaks[0]);
      quad(breaks[0], breaks[1], ridge1, ridge0);
      quad(ridge0, ridge1, breaks[2], breaks[3]);
      quad(breaks[3], breaks[2], 2, 3);

      // Create the side triangles for the gambrel roof
      for (const side of [[3, breaks[0], ridge0, breaks[3], 0], [1, breaks[1], ridge1, breaks[2], 2]]) {
        for (let index = 1; index < side.length - 1; index++) {
          triangle(side[0], side[index], side[index + 1]);
        }
      }
    } else {
      quad(0, 1, ridge1, ridge0);
      quad(ridge0, ridge1, 2, 3);
      triangle(3, ridge0, 0);
      triangle(1, 2, ridge1);
    }
  }

  return {
    eave,
    geometry: new Mesh({
      spatialReference: footprint.spatialReference,
      vertexAttributes: { position: vertices.flat() },
      components: [{ faces, shading: "flat", material: { color, doubleSided: true } }],
    }),
  };
}

interface GeoJsonPolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface BuildingFootprint {
  geometry: Polygon;
  heightMeters: number | null;
  rooftype: string | null;
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
  const features: { geometry: GeoJsonPolygonGeometry | null; properties?: { stories?: number; rooftype?: string; roofType?: string } }[] = collection.features ?? [];
  return features
    .filter((feature) => feature.geometry)
    .map((feature) => ({
      geometry: geojsonToPolygon(feature.geometry!),
      heightMeters:
        typeof feature.properties?.stories === "number"
          ? feature.properties.stories * AVG_STORY_HEIGHT_FT * FEET_TO_METERS
          : null,
      rooftype: feature.properties?.roofType ?? feature.properties?.rooftype ?? null,
    }));
}

export const findFootprintAtPoint = (footprints: BuildingFootprint[], point: Point): BuildingFootprint | null => {
  return footprints.find((footprint) => geometryEngine.contains(footprint.geometry, point)) ?? null;
}
