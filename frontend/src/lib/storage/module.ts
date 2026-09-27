import type { SelectedLocation } from "../../types";
import { SAVED_LOCATIONS_KEY } from "./constants";

export function loadSaved(): SelectedLocation[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) ?? "[]") as SelectedLocation[];
  } catch {
    return [];
  }
}

export function saveLocation(location: SelectedLocation): SelectedLocation[] {
  const next = [location, ...loadSaved().filter((item) => item.id !== location.id)];
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}

export function removeLocation(id: string): SelectedLocation[] {
  const next = loadSaved().filter((item) => item.id !== id);
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}