import { describe, expect, it } from "vitest";
import { assessorEndpoints } from "./client";

describe("browser assessor endpoint construction", () => {
  it("encodes the selected address in the property lookup", () => {
    const params = new URLSearchParams({
      fromAddrNum: "2743",
      toAddrNum: "2743",
      address: "Wyandotte",
      city: "FORT COLLINS",
    });
    const url = new URL(assessorEndpoints.propertyUrl(params));
    expect(url.searchParams.get("address")).toBe("Wyandotte");
    expect(url.searchParams.get("city")).toBe("FORT COLLINS");
  });

  it("uses the tax year only for the tax district request", () => {
    const taxDistrict = new URL(assessorEndpoints.sectionUrl("treasurerTaxDistrict", "R1004506", "2025"));
    const detail = new URL(assessorEndpoints.sectionUrl("detail", "R1004506", "2025"));
    expect(taxDistrict.searchParams.get("yr")).toBe("2025");
    expect(detail.searchParams.has("yr")).toBe(false);
  });
});
