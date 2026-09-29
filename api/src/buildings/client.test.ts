import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBuildingFootprints,
  filterFootprintsByBBox,
  geometryBounds,
  type IndexedFootprint,
} from "./client.js";

afterEach(() => vi.unstubAllGlobals());

describe("local building footprint data", () => {
  it("computes bounds for polygon and multipolygon geometries", () => {
    expect(
      geometryBounds({
        type: "Polygon",
        coordinates: [[[-105.2, 40.1], [-105.1, 40.2], [-105.3, 40.3], [-105.2, 40.1]]],
      }),
    ).toEqual({ xmin: -105.3, ymin: 40.1, xmax: -105.1, ymax: 40.3 });
    expect(
      geometryBounds({
        type: "MultiPolygon",
        coordinates: [
          [[[-105.4, 40.4], [-105.3, 40.5], [-105.4, 40.4]]],
          [[[-105.2, 40.2], [-105.1, 40.3], [-105.2, 40.2]]],
        ],
      }),
    ).toEqual({ xmin: -105.4, ymin: 40.2, xmax: -105.1, ymax: 40.5 });
  });

  it("returns intersecting polygons as GeoJSON and stops at 1,000 features", () => {
    const footprint: IndexedFootprint = {
      bounds: { xmin: -105.1, ymin: 40.1, xmax: -105.0, ymax: 40.2 },
      geometry: { type: "Polygon", coordinates: [[[-105.1, 40.1], [-105.0, 40.1], [-105.0, 40.2], [-105.1, 40.1]]] },
    };
    const response = filterFootprintsByBBox(
      Array.from({ length: 1002 }, () => footprint),
      { xmin: -105.05, ymin: 40.15, xmax: -105.04, ymax: 40.16 },
    );

    expect(response.type).toBe("FeatureCollection");
    expect(response.features).toHaveLength(1000);
    expect(response.features[0]).toEqual({ type: "Feature", properties: {}, geometry: footprint.geometry });
    expect(
      filterFootprintsByBBox([footprint], { xmin: -104, ymin: 40.1, xmax: -103.9, ymax: 40.2 }).features,
    ).toHaveLength(0);
  });

  it("loads the provided archive and returns nearby county features", async () => {
    const bbox = { xmin: -105.91, ymin: 40.85, xmax: -105.89, ymax: 40.87 };
    const [firstResponse, secondResponse] = await Promise.all([
      fetchBuildingFootprints(bbox),
      fetchBuildingFootprints(bbox),
    ]);

    expect(firstResponse.features.length).toBeGreaterThan(0);
    expect(firstResponse.features.length).toBeLessThanOrEqual(1000);
    expect(secondResponse).toEqual(firstResponse);
  });

  it("includes the improvement roof type with stories on matched footprints", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes("/Parcels/")
        ? { features: [{ attributes: { SCHEDNUM: "123" }, geometry: { rings: [[
          [-105.92, 40.84], [-105.88, 40.84], [-105.88, 40.88], [-105.92, 40.88], [-105.92, 40.84],
        ]] } }] }
        : { records: [{ stories: "", rooftype: "" }, { stories: "2", rooftype: " Gable " }] },
    })));

    const response = await fetchBuildingFootprints({ xmin: -105.91, ymin: 40.85, xmax: -105.89, ymax: 40.87 });
    expect(response.features.length).toBeGreaterThan(0);
    expect(response.features[0].properties).toEqual({ stories: 2, rooftype: "Gable" });
  });
});