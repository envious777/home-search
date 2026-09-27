import { app, type HttpRequest, type HttpResponseInit, InvocationContext } from "@azure/functions";
import { fetchBuildingFootprints } from "../src/buildings/client.js";
import { readBBoxQuery } from "../src/http/validation.js";

export const buildingFootprints = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const bbox = readBBoxQuery(request.query);
  if (typeof bbox === "string") {
    return { status: 400, jsonBody: { error: bbox } };
  }

  try {
    const body = await fetchBuildingFootprints(bbox);
    return { status: 200, jsonBody: body };
  } catch (error) {
    context.error("Building footprint proxy failed", error);
    return { status: 504, jsonBody: { error: "The building footprint service did not respond in time. Please retry." } };
  }
}
app.http("buildingFootprints", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "building-footprints",
  handler: buildingFootprints,
});
