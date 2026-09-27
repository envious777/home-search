import type { AddressQuery } from "../models/assessor.js";

export const readAddressQuery = (params: URLSearchParams): AddressQuery | string => {
  const fromAddrNum = params.get("fromAddrNum")?.trim() ?? "";
  const toAddrNum = params.get("toAddrNum")?.trim() ?? fromAddrNum;
  const address = params.get("address")?.trim() ?? "";
  const city = params.get("city")?.trim() ?? "";
  if (!fromAddrNum || !toAddrNum || !address || !city) {
    return "fromAddrNum, toAddrNum, address, and city are required.";
  }

  if (fromAddrNum.length > 12 || toAddrNum.length > 12 || address.length > 120 || city.length > 80) {
    return "Address query values are too long.";
  }

  return { fromAddrNum, toAddrNum, address, city, zip: params.get("zip")?.trim() || undefined };
}
