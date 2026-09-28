import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBuildingFootprints } from "./client.js";

afterEach(() => vi.unstubAllGlobals());

describe("building footprint upstream request", () => {
  it("logs response metadata on 403 and sends the configured User-Agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Forbidden", { status: 403, headers: { server: "awselb/2.0", "content-type": "text/html" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchBuildingFootprints({ xmin: -105.081, ymin: 40.579, xmax: -105.080, ymax: 40.580 }),
    ).rejects.toThrow("upstream status 403 (server: awselb/2.0, content-type: text/html)");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("request=GetFeature"),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": "Mozilla/5.0 (compatible; home-search-app/1.0)" }),
      }),
    );
  });
});