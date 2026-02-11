import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Квадратные метры: символ U+00B2 (²). Кубические метры: U+00B3 (³) */
const SQUARE_METER = "м\u00B2"
const CUBIC_METER = "м\u00B3"

/** Округление количества материалов до 3 знаков после запятой (остатки, потребность, объёмы) */
export function roundMaterialQty(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1000) / 1000
}

/** Форматирование количества материалов для отображения (ровно 3 знака после запятой, локаль ru-RU) */
export function formatMaterialQty(value: number): string {
  return roundMaterialQty(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

/** Единицы измерения: м2/м.кв./кв.м → м² (U+00B2), м3/м.куб./куб.м → м³ (U+00B3) */
export function formatUnit(unit: string | null | undefined): string {
  if (unit == null || unit === "") return ""
  return String(unit)
    .replace(/(м|m)\s*2|м\.?\s*кв\.?|кв\.?\s*м\.?/gi, SQUARE_METER)
    .replace(/(м|m)\s*3|м\.?\s*куб\.?|куб\.?\s*м\.?/gi, CUBIC_METER)
}
