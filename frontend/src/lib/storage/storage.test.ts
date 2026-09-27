import { beforeEach, describe, expect, it } from "vitest";
import { saveLocation, removeLocation, loadSaved } from "./module";

const location = {
  id: "one",
  canonicalAddress: "2743 Wyandotte Street, Fort Collins, CO",
  latitude: 40.58,
  longitude: -105.08,
  attributes: {},
  savedAt: "2026-01-01",
};

describe("saved locations", () => {
  beforeEach(() => localStorage.clear());
  it("is idempotent and removable", () => {
    expect(saveLocation(location)).toHaveLength(1);
    expect(saveLocation(location)).toHaveLength(1);
    expect(removeLocation("one")).toEqual([]);
    expect(loadSaved()).toEqual([]);
  });
});
