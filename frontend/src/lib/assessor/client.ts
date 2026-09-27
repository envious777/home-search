import type { AssessorAnalysis } from "../../types";
import { apiBase } from "../global";

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
