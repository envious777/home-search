import type { AssessorAnalysis } from "../../types";

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export const analyzeAddress = async (params: URLSearchParams): Promise<AssessorAnalysis> => {
  const response = await fetch(`${apiBase}/assessor-analysis?${params}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? body.errors?.[0] ?? `Assessor analysis failed (${response.status})`);
  }
  return body as AssessorAnalysis;
};
