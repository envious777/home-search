import { Theme } from "../types";
import { THEME_KEY } from "./storage/constants";

export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export const initialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};