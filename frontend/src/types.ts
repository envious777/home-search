export interface SelectedLocation {
  id: string;
  canonicalAddress: string;
  city?: string;
  latitude: number;
  longitude: number;
  attributes: Record<string, unknown>;
  savedAt: string;
}

export interface LayerDefinition {
  id: string;
  title: string;
  url: string;
  color: string;
  description: string;
  legend?: {
    title: string;
    entries: { label: string; color: string; shape: "area" | "drop" | "circle" }[];
  }[];
  imageLayers?: { title: string; url: string; sublayerIds: number[] }[];
  extraFeatureLayers?: { title: string; url: string; definitionExpression?: string }[];
  pointTable?: {
    latitudeField: string;
    longitudeField: string;
    dateField: string;
    displayField: string;
    popupFields: { fieldName: string; label: string }[];
  };
}

export interface BuildingInfo {
  squareFeet: number;
  stories: number;
  rooftype: string | null;
}

export interface AssessorAnalysis {
  address: { fromAddrNum: string; toAddrNum: string; address: string; city: string; zip?: string };
  accountno: string | null;
  sections: Record<string, { status: string; data: unknown; error: string | null }>;
  errors: string[];
  partial: boolean;
}

export type Theme = "light" | "dark";
