import { describe, expect, it } from "vitest";
import { readBBoxQuery } from "../http/validation.js";
import { propertyUrl, sectionUrl } from "./endpoints.js";

describe("assessor endpoint construction", () => {
  it("encodes selected address fields server-side", () =>
    expect(
      propertyUrl({ fromAddrNum: "2743", toAddrNum: "2743", address: "Wyandotte", city: "FORT COLLINS" }),
    ).toContain("address=Wyandotte"));
  it("uses the configured tax year only for tax district", () =>
    expect(sectionUrl("treasurerTaxDistrict", "R1004506", "2025")).toContain("yr=2025"));
});

describe("bbox validation", () => {
  it("accepts a two-degree map extent for building footprint lookups", () => {
    const bbox = readBBoxQuery(new URLSearchParams({
      xmin: "-105.5",
      ymin: "40.2",
      xmax: "-103.5",
      ymax: "42.2",
    }));

    expect(typeof bbox).not.toBe("string");
    expect(bbox).toMatchObject({ xmin: -105.5, ymin: 40.2, xmax: -103.5, ymax: 42.2 });
  });

  it("accepts a real Web Mercator extent from the map view and converts it to geographic bounds", () => {
    const bbox = readBBoxQuery(new URLSearchParams({
      xmin: "-11713275.740224525",
      ymin: "4938503.856340351",
      xmax: "-11683075.598270295",
      ymax: "4964190.09058218",
    }));

    expect(typeof bbox).not.toBe("string");
    expect(bbox).toMatchObject({
      xmin: expect.closeTo(-105.22214624550092, 6),
      ymin: expect.closeTo(40.49750451380324, 6),
      xmax: expect.closeTo(-104.95085375450029, 6),
      ymax: expect.closeTo(40.67274014978543, 6),
    });
  });
});
