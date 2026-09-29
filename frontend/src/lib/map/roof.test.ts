import { describe, expect, it, vi } from "vitest";
import Extent from "@arcgis/core/geometry/Extent";
import Polygon from "@arcgis/core/geometry/Polygon";
import { buildingRoof, fetchBuildingFootprints } from "./module";
import { extractBuildingInfo } from "../assessor/module";
import type { AssessorAnalysis } from "../../types";

const footprint = new Polygon({
  rings: [[[-105, 40], [-104.9998, 40], [-104.9998, 40.0001], [-105, 40.0001], [-105, 40]]],
  spatialReference: { wkid: 4326 },
});

vi.stubGlobal("ImageData", class ImageData {});

describe("selected building roof", () => {
  it("reads the improvement roof type with the building dimensions", () => {
    const analysis = { sections: { improvement: { data: { records: [{ sf: "1800", stories: "2", rooftype: " Gable " }] } } } } as unknown as AssessorAnalysis;
    expect(extractBuildingInfo(analysis)).toEqual({ squareFeet: 1800, stories: 2, rooftype: "Gable" });
  });

  it.each(["Gable", "Gambrel", "Hip", "Hip/Gable", "Shed"])("adds a pitched %s cap below the estimated height", (shape) => {
    const roof = buildingRoof(footprint, 6, shape);
    expect(roof).not.toBeNull();
    const positions = Array.from(roof!.geometry.vertexAttributes.position);
    const elevations = positions.filter((_, index) => index % 3 === 2);
    expect(Math.max(...elevations)).toBe(6);
    expect(Math.min(...elevations)).toBeCloseTo(roof!.eave);
    expect(roof!.eave).toBeGreaterThan(0);
    expect(roof!.geometry.components?.[0]?.faces?.length).toBeGreaterThan(0);
  });

  it.each([null, "", "Flat", "Irregular", "Prestressed Crete", "Reinforced Crete", "Steel Frame"])(
    "keeps a flat cap for %s", (shape) => {
      expect(buildingRoof(footprint, 6, shape)).toBeNull();
    },
  );

  it("does not fabricate a pitched cap for an irregular footprint", () => {
    const irregular = new Polygon({
      rings: [[[-105, 40], [-104.9998, 40], [-104.9999, 40.0001], [-105, 40.0001], [-105, 40]]],
      spatialReference: { wkid: 4326 },
    });
    expect(buildingRoof(irregular, 6, "Gable")).toBeNull();
  });

  it("maps roof types from neighboring footprint responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ features: [
        { geometry: { type: "Polygon", coordinates: footprint.rings }, properties: { stories: 2, roofType: "Hip" } },
        { geometry: { type: "Polygon", coordinates: footprint.rings }, properties: { stories: 1, rooftype: "Gable" } },
        { geometry: { type: "Polygon", coordinates: footprint.rings }, properties: {} },
      ] }),
    } as Response);
    try {
      const neighbors = await fetchBuildingFootprints(new Extent({ xmin: -105, ymin: 40, xmax: -104, ymax: 41, spatialReference: { wkid: 4326 } }));
      expect(neighbors[0].rooftype).toBe("Hip");
      expect(neighbors[0].heightMeters).toBeGreaterThan(0);
      expect(buildingRoof(neighbors[0].geometry, neighbors[0].heightMeters!, neighbors[0].rooftype)).not.toBeNull();
      expect(neighbors[1].rooftype).toBe("Gable");
      expect(neighbors[2].rooftype).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
  });
});