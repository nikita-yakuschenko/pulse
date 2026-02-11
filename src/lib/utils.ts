import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Квадратные метры: символ U+00B2 (²). Кубические метры: U+00B3 (³) */
const SQUARE_METER = "м\u00B2"
const CUBIC_METER = "м\u00B3"

/** Единицы измерения: м2/м.кв./кв.м → м² (U+00B2), м3/м.куб./куб.м → м³ (U+00B3) */
export function formatUnit(unit: string | null | undefined): string {
  if (unit == null || unit === "") return ""
  return String(unit)
    .replace(/(м|m)\s*2|м\.?\s*кв\.?|кв\.?\s*м\.?/gi, SQUARE_METER)
    .replace(/(м|m)\s*3|м\.?\s*куб\.?|куб\.?\s*м\.?/gi, CUBIC_METER)
}
