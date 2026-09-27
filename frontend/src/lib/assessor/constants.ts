export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const deedTypes: Record<string, string> = {
  WD: "Warranty deed",
  WDJ: "Warranty deed (joint tenancy)",
  QC: "Quitclaim deed",
  SWD: "Special warranty deed",
  BSD: "Bargain & sale deed",
  PRD: "Personal representative's deed",
  TD: "Trustee deed",
  PTD: "Public trustee's deed",
};

// Larimer County parcel format: range(1) township(1) section(2) quarter section(1) block(2) lot(3).
export const parcelParts: [string, number][] = [
  ["Range", 1],
  ["Township", 1],
  ["Section", 2],
  ["Quarter", 1],
  ["Block", 2],
  ["Lot", 3],
];

export const areaDetailTypes = new Set(["Basement", "Garage", "Porch", "Deck", "Patio", "Carport"]);
export const valueColors = ["#4d7c0f", "#176b87", "#d97706", "#7c3aed"];
export const assessorSectionOrder = [
  "detail",
  "improvement",
  "valueDetail",
  "treasurerPropertyInfo",
  "treasurerTaxDistrict",
  "sales",
  "improvementDetail",
  "landAttributes",
  "limit",
];
export const assessorViewMetadata: Record<string, { title: string; open?: boolean }> = {
  detail: { title: "Property", open: true },
  improvement: { title: "Building", open: true },
  valueDetail: { title: "Valuation", open: true },
  treasurerPropertyInfo: { title: "Property tax", open: true },
  treasurerTaxDistrict: { title: "Tax breakdown" },
  sales: { title: "Sales history", open: true },
  improvementDetail: { title: "Building features" },
  landAttributes: { title: "Land" },
  limit: { title: "Tax district" },
};

export const TAX_CHART_WIDTH = 340;
export const TAX_CHART_HEIGHT = 110;
export const TAX_CHART_TOP = 14;
export const TAX_CHART_GAP = 2;
