import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";

export function health(_request: HttpRequest): HttpResponseInit {
  const configured = Boolean(process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage);
  return {
    status: configured ? 200 : 503,
    jsonBody: {
      status: configured ? "ok" : "degraded",
      services: { assessor: "configured", storage: configured ? "configured" : "missing" },
    },
  };
}
app.http("health", { methods: ["GET"], authLevel: "anonymous", route: "health", handler: health });
