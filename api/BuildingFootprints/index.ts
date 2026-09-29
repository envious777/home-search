import { app, type HttpRequest, type HttpResponseInit, InvocationContext } from "@azure/functions";
import { fetchBuildingFootprints } from "../src/buildings/client.js";
import { readBBoxQuery } from "../src/http/validation.js";

export const buildingFootprints = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const bbox = readBBoxQuery(request.query);
  if (typeof bbox === "string") {
    context.warn?.("Rejected building footprint request", { error: bbox });
    return { status: 400, jsonBody: { error: bbox } };
  }

  try {
    context.log?.("Building footprint request received", { bbox });
    const body = await fetchBuildingFootprints(bbox, context);
    context.log?.("Building footprint response ready", {
      footprintCount: body.features.length,
      enrichedCount: body.features.filter((feature) => feature.properties.stories !== undefined).length,
    });

    return { status: 200, jsonBody: body };
  } catch (error) {
    context.error("Building footprint proxy failed", error);
    
    const timedOut = typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
    return timedOut
      ? { status: 504, jsonBody: { error: "The building footprint service did not respond in time. Please retry." } }
      : { status: 502, jsonBody: { error: "The building footprint service is unavailable. Please retry." } };
  }
}
app.http("buildingFootprints", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "building-footprints",
  handler: buildingFootprints,
});
