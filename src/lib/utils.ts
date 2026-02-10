import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Единицы измерения: м2 → м² (U+00B2), м3 → м³ (U+00B3) */
export function formatUnit(unit: string | null | undefined): string {
  if (unit == null || unit === "") return ""
  return String(unit)
    .replace(/(м|m)\s*2/gi, "м²")
    .replace(/(м|m)\s*3/gi, "м³")
}
