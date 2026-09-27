import { propertyUrl, sectionUrl, sections } from "./endpoints.js";
import type { AddressQuery, AssessorResponse, SectionName, SectionResult } from "../models/assessor.js";

const timeoutMs = 8000;
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`upstream status ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function findAccount(payload: unknown): string | null {
  const container =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).records ?? (payload as Record<string, unknown>).data ?? payload)
      : payload;
  const item = Array.isArray(container) ? container[0] : container;
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const candidate = record.accountno ?? record.accountNo ?? record.account_number ?? record.AccountNo;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export async function analyzeAddress(
  address: AddressQuery,
  year = process.env.TAX_YEAR ?? "2025",
): Promise<{ status: number; body: AssessorResponse }> {
  let property: unknown;
  try {
    property = await fetchJson(propertyUrl(address));
  } catch {
    return {
      status: 502,
      body: {
        address,
        accountno: null,
        sections: {} as Record<SectionName, SectionResult>,
        errors: ["The Larimer County property search is unavailable. Please retry."],
        partial: false,
      },
    };
  }
  const accountno = findAccount(property);
  if (!accountno)
    return {
      status: 502,
      body: {
        address,
        accountno: null,
        sections: {} as Record<SectionName, SectionResult>,
        errors: ["No assessor account was found for the selected address."],
        partial: false,
      },
    };

  const results = await Promise.allSettled(sections.map((section) => fetchJson(sectionUrl(section, accountno, year))));
  const output = Object.fromEntries(
    results.map((result, index) => {
      const section = sections[index];
      return [
        section,
        result.status === "fulfilled"
          ? { status: "fulfilled", data: result.value, error: null }
          : ({
              status: "rejected",
              data: null,
              error: "This assessor section is temporarily unavailable.",
            } satisfies SectionResult),
      ];
    }),
  ) as Record<SectionName, SectionResult>;
  const errors = Object.values(output)
    .filter((section) => section.status === "rejected")
    .map((section) => section.error ?? "Unavailable section");
  return {
    status: errors.length ? 206 : 200,
    body: { address, accountno, sections: output, errors, partial: errors.length > 0 },
  };
}
