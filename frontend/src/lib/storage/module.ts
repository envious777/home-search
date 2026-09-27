import type { SelectedLocation } from "../../types";
import { SAVED_LOCATIONS_KEY } from "./constants";

export const loadSaved = (): SelectedLocation[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) ?? "[]") as SelectedLocation[];
  } catch {
    return [];
  }
}

export const saveLocation = (location: SelectedLocation): SelectedLocation[] => {
  const next = [location, ...loadSaved().filter((item) => item.id !== location.id)];
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}

export const removeLocation = (id: string): SelectedLocation[] => {
  const next = loadSaved().filter((item) => item.id !== id);
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}