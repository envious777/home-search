export type SectionName =
  | "detail"
  | "sales"
  | "landAttributes"
  | "improvement"
  | "valueDetail"
  | "improvementDetail"
  | "limit"
  | "treasurerPropertyInfo"
  | "treasurerTaxDistrict";

export interface AddressQuery {
  fromAddrNum: string;
  toAddrNum: string;
  address: string;
  city: string;
  zip?: string;
}

export interface SectionResult {
  status: "fulfilled" | "rejected";
  data: unknown;
  error: string | null;
}

export interface AssessorResponse {
  address: AddressQuery;
  accountno: string | null;
  sections: Record<SectionName, SectionResult>;
  errors: string[];
  partial: boolean;
}
