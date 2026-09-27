import { app, type HttpRequest, type HttpResponseInit, InvocationContext } from "@azure/functions";
import { analyzeAddress } from "../src/assessor/client.js";
import { readAddressQuery } from "../src/http/validation.js";

export const assessorAnalysis = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const query = readAddressQuery(request.query);
  if (typeof query === "string") {
    return { status: 400, jsonBody: { error: query } };
  }

  try {
    const result = await analyzeAddress(query);
    return { status: result.status, jsonBody: result.body };
  } catch (error) {
    context.error("Assessor aggregation failed", error);
    return { status: 504, jsonBody: { error: "The assessor service did not respond in time. Please retry." } };
  }
}
app.http("assessorAnalysis", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "assessor-analysis",
  handler: assessorAnalysis,
});
