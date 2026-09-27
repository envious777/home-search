const WFS_URL = "https://geo.colorado.edu/geoserver/geocolorado/wfs";
const TYPE_NAME = "geocolorado:larimer_county_buildings";
const FETCH_LIMIT = 1000;
const timeoutMs = 8000;

export interface BBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

// geo.colorado.edu does not send CORS headers, so this is fetched server-side and relayed to the browser.
export const fetchBuildingFootprints = async (bbox: BBox): Promise<unknown> => {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: TYPE_NAME,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    bbox: `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax},EPSG:4326`,
    count: String(FETCH_LIMIT),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // geo.colorado.edu returns 403 for requests without a browser-like User-Agent.
    const response = await fetch(`${WFS_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; home-search-app/1.0)",
      },
    });
    if (!response.ok) {
      throw new Error(`upstream status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
