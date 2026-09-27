import { describe, expect, it } from "vitest";
import { propertyUrl, sectionUrl } from "./endpoints.js";
describe("assessor endpoint construction", () => {
  it("encodes selected address fields server-side", () =>
    expect(
      propertyUrl({ fromAddrNum: "2743", toAddrNum: "2743", address: "Wyandotte", city: "FORT COLLINS" }),
    ).toContain("address=Wyandotte"));
  it("uses the configured tax year only for tax district", () =>
    expect(sectionUrl("treasurerTaxDistrict", "R1004506", "2025")).toContain("yr=2025"));
});
