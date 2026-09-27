import type { AddressQuery } from "../models/assessor.js";
import type { BBox } from "../buildings/client.js";

export const readAddressQuery = (params: URLSearchParams): AddressQuery | string => {
  const fromAddrNum = params.get("fromAddrNum")?.trim() ?? "";
  const toAddrNum = params.get("toAddrNum")?.trim() ?? fromAddrNum;
  const address = params.get("address")?.trim() ?? "";
  const city = params.get("city")?.trim() ?? "";
  if (!fromAddrNum || !toAddrNum || !address || !city) {
    return "fromAddrNum, toAddrNum, address, and city are required.";
  }

  if (fromAddrNum.length > 12 || toAddrNum.length > 12 || address.length > 120 || city.length > 80) {
    return "Address query values are too long.";
  }

  return { fromAddrNum, toAddrNum, address, city, zip: params.get("zip")?.trim() || undefined };
}

const WEB_MERCATOR_RADIUS = 6378137;
const MAX_BBOX_DEGREES = 2;

const webMercatorToLonLat = (x: number, y: number) => {
  const lon = (x / WEB_MERCATOR_RADIUS) * (180 / Math.PI);
  const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - Math.PI / 2);
  return { lon, lat };
};

export const readBBoxQuery = (params: URLSearchParams): BBox | string => {
  const xmin = Number(params.get("xmin"));
  const ymin = Number(params.get("ymin"));
  const xmax = Number(params.get("xmax"));
  const ymax = Number(params.get("ymax"));
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) {
    return "xmin, ymin, xmax, and ymax are required numeric query parameters.";
  }

  const looksProjected = Math.abs(xmin) > 180 || Math.abs(xmax) > 180 || Math.abs(ymin) > 90 || Math.abs(ymax) > 90;
  const normalized = looksProjected
    ? {
        xmin: webMercatorToLonLat(xmin, ymin).lon,
        ymin: webMercatorToLonLat(xmin, ymin).lat,
        xmax: webMercatorToLonLat(xmax, ymax).lon,
        ymax: webMercatorToLonLat(xmax, ymax).lat,
      }
    : { xmin, ymin, xmax, ymax };

  if (normalized.xmax <= normalized.xmin || normalized.ymax <= normalized.ymin) {
    return "xmax/ymax must be greater than xmin/ymin.";
  }

  if (normalized.xmax - normalized.xmin > MAX_BBOX_DEGREES || normalized.ymax - normalized.ymin > MAX_BBOX_DEGREES) {
    return "Requested bounding box is too large.";
  }

  return normalized;
}
