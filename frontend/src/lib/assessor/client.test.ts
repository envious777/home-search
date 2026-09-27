import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeAddress } from "./client";

const params = new URLSearchParams({
  fromAddrNum: "2743",
  toAddrNum: "2743",
  address: "Wyandotte",
  city: "FORT COLLINS",
});

afterEach(() => vi.unstubAllGlobals());

describe("assessor analysis API client", () => {
  it.each([200, 206])("returns the API response for status %i", async (status) => {
    const body = { accountno: "R1004506", sections: {}, errors: [], partial: status === 206 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeAddress(params)).resolves.toEqual(body);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url, "http://localhost").pathname).toBe("/api/assessor-analysis");
    expect(new URL(url, "http://localhost").searchParams.get("city")).toBe("FORT COLLINS");
    expect(options.headers.Accept).toBe("application/json");
  });

  it("reports an API error from the response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ errors: ["No assessor account was found for the selected address."] }),
    }));

    await expect(analyzeAddress(params)).rejects.toThrow("No assessor account was found for the selected address.");
  });
});
