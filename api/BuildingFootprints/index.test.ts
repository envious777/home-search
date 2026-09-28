import { describe, expect, it, vi } from "vitest";
import { fetchBuildingFootprints } from "../src/buildings/client.js";
import { buildingFootprints } from "./index.js";

vi.mock("../src/buildings/client.js", () => ({ fetchBuildingFootprints: vi.fn() }));

const request = {
  query: new URLSearchParams("xmin=-105.081&ymin=40.579&xmax=-105.080&ymax=40.580"),
} as Parameters<typeof buildingFootprints>[0];
const context = { error: vi.fn() } as unknown as Parameters<typeof buildingFootprints>[1];

describe("building footprint upstream errors", () => {
  it("reports an upstream 403 as a bad gateway, not a timeout", async () => {
    vi.mocked(fetchBuildingFootprints).mockRejectedValueOnce(new Error("upstream status 403"));

    const response = await buildingFootprints(request, context);

    expect(response.status).toBe(502);
    expect(response.jsonBody).toEqual({ error: "The building footprint service is unavailable. Please retry." });
  });

  it("reports an aborted upstream request as a timeout", async () => {
    vi.mocked(fetchBuildingFootprints).mockRejectedValueOnce(new DOMException("aborted", "AbortError"));

    const response = await buildingFootprints(request, context);

    expect(response.status).toBe(504);
  });
});