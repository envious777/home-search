import type { AddressQuery, SectionName } from "../models/assessor.js";

const BASE = "https://apps.larimer.org/api/assessor2";
export const sections: SectionName[] = [
  "detail",
  "sales",
  "landAttributes",
  "improvement",
  "valueDetail",
  "improvementDetail",
  "limit",
  "treasurerPropertyInfo",
  "treasurerTaxDistrict",
];

export function propertyUrl(address: AddressQuery): string {
  const params = new URLSearchParams({
    prop: "property",
    parcel: "undefined",
    scheduleNumber: "undefined",
    serialIdentification: "undefined",
    fromAddrNum: address.fromAddrNum,
    toAddrNum: address.toAddrNum,
    address: address.address,
    city: address.city,
    zip: address.zip ?? "undefined",
    subdivisionNumber: "undefined",
    sales: "any",
    subdivisionName: "",
    address2: "",
  });
  return `${BASE}/property/?${params}`;
}

export function sectionUrl(section: SectionName, accountno: string, year: string): string {
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
  if (section === "treasurerTaxDistrict") query.set("yr", year);
  return `${base}?${query}`;
}
