import type { LayerDefinition } from "../../types";

export const TIMELAPSE_START_YEAR = 1999;
export const TIMELAPSE_END_YEAR = 2025;
export const TIMELAPSE_FRAME_MS = 1500;
export const IMAGERY_ROOT = "https://maps1.larimer.org/arcgis/rest/services/Imagery";

// Larimer only publishes some years, and service names are inconsistent across years.
export const IMAGERY_SERVICES_BY_YEAR: Record<number, string> = {
  1999: "imagery1999only",
  2002: "imagery2002only",
  2005: "imagery2005only",
  2007: "imagery2007only",
  2008: "imagery2008only",
  2009: "imagery2009only",
  2010: "imagery2010only",
  2011: "imagery2011only",
  2012: "imagery2012_fullCounty",
  2014: "imagery2014only",
  2016: "imagery2016FullCounty",
  2019: "imagery2019FullCounty",
  2021: "imagery2021FullCounty",
  2023: "imagery2023FullCounty",
  2025: "imagery2025FullCounty",
};
export const imageryYears = Object.keys(IMAGERY_SERVICES_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

export const MAP_CENTER: [number, number] = [-105.0865, 40.5853];
export const MAP_INITIAL_ZOOM = 12;
export const SELECTED_ZOOM = 20;
export const LARIMER_COUNTY_BOUNDS = { xmin: -106.2, ymin: 40.2, xmax: -104.3, ymax: 41.2 };
export const GEOCODER_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
export const DEFAULT_SUN_HOUR = 15;
export const MIN_SUN_HOUR = 6;
export const MAX_SUN_HOUR = 20;

// Solstices/equinoxes bracket the yearly extremes of sun angle, so they cover the useful shadow cases.
export const SUN_DATES: { id: string; label: string; month?: number; day?: number }[] = [
  { id: "today", label: "Today" },
  { id: "spring", label: "Mar 20 (Spring)", month: 2, day: 20 },
  { id: "summer", label: "Jun 21 (Summer)", month: 5, day: 21 },
  { id: "fall", label: "Sep 22 (Fall)", month: 8, day: 22 },
  { id: "winter", label: "Dec 21 (Winter)", month: 11, day: 21 },
];
export const DEFAULT_SUN_DATE_ID = "today";
// Higher sun angles produce shorter, less legible shadows and therefore need a stronger display boost.
export const MIN_SHADOW_CONTRAST = 1.45;
export const MAX_SHADOW_CONTRAST = 2;
export const MIN_SHADOW_BRIGHTNESS = 0.82;
export const MAX_SHADOW_BRIGHTNESS = 0.92;
export const MIN_SHADOW_IMAGERY_OPACITY = 0.34;
export const MAX_SHADOW_IMAGERY_OPACITY = 0.5;

export const MAP_PIN_PATH =
  "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z";
export const MAP_PIN_OUTLINE = "#173042";
export const SAVED_PIN_COLOR = "#2F6F8F";
export const ACTIVE_PIN_COLOR = "#4D7C0F";
export const BUILDING_COLOR = [77, 124, 15, 0.55];
export const AVG_STORY_HEIGHT_FT = 10;
export const FEET_TO_METERS = 0.3048;
export const FOOTPRINT_ASPECT_RATIO = 1.5;
export const FEET_PER_DEGREE_LATITUDE = 364_000;

// Larimer County building footprints (real parcel geometry), used to improve shadow accuracy over the rectangle estimate.
// Fetched via the backend proxy (see api/BuildingFootprints) since geo.colorado.edu does not send CORS headers.
export const BUILDING_FOOTPRINTS_API_URL = "/api/building-footprints";
// Below this zoom the extent covers too many footprints, which risks rate limiting the WMS/WFS server.
export const MIN_FOOTPRINT_ZOOM = 20;
// SceneView derives zoom from camera altitude, so goTo(SELECTED_ZOOM) settles slightly under the integer level.
export const FOOTPRINT_ZOOM_TOLERANCE = 0.5;
// Neighboring footprints only cast shadows; their real height is unknown so a modest default is used.
export const CONTEXT_BUILDING_HEIGHT_FT = 15;
export const CONTEXT_BUILDING_COLOR = [130, 130, 130, 0.35];

export const layers: LayerDefinition[] = [
  {
    id: "fema",
    title: "FloodPlain FEMA",
    url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/FloodPlain_FEMA/FeatureServer/0/query",
    color: "#0566f7",
    description: "Federal flood hazard zones",
    legend: [
      {
        title: "FEMA Floodplain",
        entries: [
          { label: "HIGH FLOODWAY", color: "#1768f5", shape: "area" },
          { label: "HIGH", color: "#67d8ee", shape: "area" },
          { label: "MODERATE", color: "#c9f5b4", shape: "area" },
        ],
      },
    ],
  },
  {
    id: "city-flood",
    title: "FloodPlain City",
    url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/FloodPlain_City/FeatureServer/0/query",
    color: "#0566f7",
    description: "Fort Collins local floodplain",
    legend: [
      {
        title: "City Floodplains",
        entries: [
          { label: "HIGH FLOODWAY", color: "#438cf5", shape: "area" },
          { label: "HIGH", color: "#8be2f2", shape: "area" },
          { label: "MODERATE", color: "#d4f5c1", shape: "area" },
        ],
      },
    ],
  },
  {
    id: "bikeway",
    title: "Bikeway System",
    url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/BikeFacilities/FeatureServer/0/query",
    color: "#7C3AED",
    description: "Bike facilities, routes, and bike-use trails",
    extraFeatureLayers: [
      {
        title: "Trails (bike use)",
        url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/Trails/FeatureServer/0",
        definitionExpression: "BIKEUSE = 'Yes'",
      },
    ],
  },
  {
    id: "trails",
    title: "Trails",
    url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/Trails/FeatureServer/0",
    color: "#15803D",
    description: "All trails",
  },
  {
    id: "flood-warning",
    title: "Fort Collins Flood Warning",
    url: "https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/Fort_Collins_Floodwarning_Stream_Gage_Stage_and_Flow_Data_csv/FeatureServer/0",
    color: "rgba(217, 119, 6, 0.5)",
    description: "Stream and rain warnings with stream gage readings",
    legend: [
      {
        title: "Rain Gauge",
        entries: [
          { label: "24 Hr Rain Totals", color: "#39bdf1", shape: "drop" },
          { label: "Inactive", color: "#858585", shape: "drop" },
        ],
      },
      {
        title: "Stream Gauge",
        entries: [
          { label: "1", color: "#39df0b", shape: "circle" },
          { label: "2", color: "#ebeb00", shape: "circle" },
          { label: "3", color: "#f20b0b", shape: "circle" },
          { label: "4", color: "#bd00df", shape: "circle" },
          { label: "Inactive", color: "#bdbdbd", shape: "circle" },
        ],
      },
    ],
    imageLayers: [
      {
        title: "Stream Warning",
        url: "https://gis.fortcollins.gov/arcgis/rest/services/StreamWarning/MapServer",
        sublayerIds: [0, 1],
      },
      {
        title: "Rain Warning",
        url: "https://gis.fortcollins.gov/arcgis/rest/services/RainWarning/MapServer",
        sublayerIds: [7, 6],
      },
    ],
    pointTable: {
      latitudeField: "Latitude",
      longitudeField: "Longitude",
      dateField: "Timestamp",
      displayField: "Sensor_Name",
      popupFields: [
        { fieldName: "Timestamp", label: "Reading time" },
        { fieldName: "Stage__ft_", label: "Stage (ft)" },
        { fieldName: "Flow__cfs_", label: "Flow (cfs)" },
      ],
    },
  },
];