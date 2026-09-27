import type { AssessorAnalysis, BuildingInfo } from "../../types";
import { currency, decimal, parcelParts } from "./constants";

export type Row = Record<string, string | null>;
export interface Table {
  columns: string[];
  records: Row[];
}

export function asTable(data: unknown): Table | null {
  if (!data || typeof data !== "object") return null;
  const { columns, records } = data as Partial<Table>;
  return Array.isArray(columns) && Array.isArray(records) ? { columns, records } : null;
}

export function extractBuildingInfo(analysis: AssessorAnalysis | null): BuildingInfo | null {
  const data = analysis?.sections.improvement?.data as
    { records?: Array<{ sf?: string | null; stories?: string | null }> } | undefined;
  const record = data?.records?.[0];
  const squareFeet = Number(record?.sf);
  const stories = Number(record?.stories);
  if (!Number.isFinite(squareFeet) || squareFeet <= 0 || !Number.isFinite(stories) || stories <= 0) return null;
  return { squareFeet, stories };
}

export const num = (value: string | null | undefined) => {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const money = (value: string | null | undefined) => {
  const valueNumber = num(value);
  return valueNumber == null ? "—" : currency.format(valueNumber);
};

export const count = (value: string | null | undefined) => {
  const valueNumber = num(value);
  return valueNumber == null ? "—" : decimal.format(valueNumber);
};

export const text = (value: string | null | undefined) => value?.trim() || "—";
export const date = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";
export const humanize = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
export const pct = (value: number) => `${value >= 0 ? "+" : ""}${decimal.format(value * 100)}%`;

export function splitParcel(parcel: string | null | undefined): [string, string][] | null {
  const digits = parcel?.replace(/\D/g, "") ?? "";
  if (digits.length !== 10) return null;
  let offset = 0;
  return parcelParts.map(([label, length]) => [label, digits.slice(offset, (offset += length))]);
}