import type { AssessorAnalysis } from "../../types";

const BASE = "https://apps.larimer.org/api/assessor2";
const timeoutMs = 8000;
const sections = [
  "detail",
  "sales",
  "landAttributes",
  "improvement",
  "valueDetail",
  "improvementDetail",
  "limit",
  "treasurerPropertyInfo",
  "treasurerTaxDistrict",
] as const;
type SectionName = (typeof sections)[number];

const propertyUrl = (params: URLSearchParams): string => {
  const query = new URLSearchParams({
    prop: "property",
    parcel: "undefined",
    scheduleNumber: "undefined",
    serialIdentification: "undefined",
    fromAddrNum: params.get("fromAddrNum") ?? "",
    toAddrNum: params.get("toAddrNum") ?? "",
    address: params.get("address") ?? "",
    city: params.get("city") ?? "",
    zip: params.get("zip") ?? "undefined",
    subdivisionNumber: "undefined",
    sales: "any",
    subdivisionName: "",
    address2: "",
  });
  return `${BASE}/property/?${query}`;
};

const sectionUrl = (section: SectionName, accountno: string, year: string): string => {
  const prop: Record<SectionName, string> = {
    detail: "detail",
    sales: "sales",
    landAttributes: "landatt",
    improvement: "improvement",
    valueDetail: "valuedetail",
    improvementDetail: "impdtl",
    limit: "limit",
    treasurerPropertyInfo: "propinfo",
    treasurerTaxDistrict: "taxdist",
  };
  const base = section.startsWith("treasurer") ? `${BASE}/treasurer/` : `${BASE}/`;
  const query = new URLSearchParams({ prop: prop[section], accountno });
  if (section === "treasurerTaxDistrict") {
    query.set("yr", year);
  }
  return `${base}?${query}`;
};

const fetchJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`upstream status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const findAccount = (payload: unknown): string | null => {
  const container =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).records ?? (payload as Record<string, unknown>).data ?? payload)
      : payload;
  const item = Array.isArray(container) ? container[0] : container;
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  const candidate = record.accountno ?? record.accountNo ?? record.account_number ?? record.AccountNo;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

export const analyzeAddress = async (params: URLSearchParams): Promise<AssessorAnalysis> => {
  let property: unknown;
  try {
    property = await fetchJson(propertyUrl(params));
  } catch {
    throw new Error("The Larimer County property search is unavailable. Please retry.");
  }

  const address = {
    fromAddrNum: params.get("fromAddrNum") ?? "",
    toAddrNum: params.get("toAddrNum") ?? "",
    address: params.get("address") ?? "",
    city: params.get("city") ?? "",
    ...(params.get("zip") ? { zip: params.get("zip") ?? undefined } : {}),
  };
  const accountno = findAccount(property);
  if (!accountno) {
    throw new Error("No assessor account was found for the selected address.");
  }

  const year = import.meta.env.VITE_TAX_YEAR ?? "2025";
  const results = await Promise.allSettled(sections.map((section) => fetchJson(sectionUrl(section, accountno, year))));
  const output = Object.fromEntries(
    results.map((result, index) => {
      const section = sections[index];
      return [
        section,
        result.status === "fulfilled"
          ? { status: "fulfilled", data: result.value, error: null }
          : { status: "rejected", data: null, error: "This assessor section is temporarily unavailable." },
      ];
    }),
  );
  const errors = Object.values(output)
    .filter((section) => section.status === "rejected")
    .map((section) => section.error ?? "Unavailable section");
  return { address, accountno, sections: output, errors, partial: errors.length > 0 };
};

export const assessorEndpoints = { propertyUrl, sectionUrl };
