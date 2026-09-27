import { DEFAULT_CITY, STREET_DIRECTIONALS, STREET_SUFFIXES } from "./constants";

export const toAddressQuery = (canonicalAddress: string, city = DEFAULT_CITY): URLSearchParams => {
  const match = canonicalAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
  const number = match?.[1] ?? "";
  const street = (match?.[2] ?? canonicalAddress).replace(STREET_SUFFIXES, "").replace(STREET_DIRECTIONALS, "").trim();
  const formattedCity = city || canonicalAddress.split(",")[1]?.trim() || "";
  return new URLSearchParams({ fromAddrNum: number, toAddrNum: number, address: street, city: formattedCity });
}