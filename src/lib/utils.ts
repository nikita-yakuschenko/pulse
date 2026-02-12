import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Единая палитра KPI: 0 = красный, 0.5 = жёлтый, 1 = зелёный.
 * Один и тот же цвет для контура, текста и прогресс-бара.
 */
const KPI_PALETTE = {
  red: [200, 40, 40] as const,
  yellow: [200, 140, 20] as const,
  green: [30, 140, 70] as const,
} as const

function interpolateKpiColor(c: number): string {
  const [r1, g1, b1] = KPI_PALETTE.red
  const [r2, g2, b2] = KPI_PALETTE.yellow
  const [r3, g3, b3] = KPI_PALETTE.green
  let r: number
  let g: number
  let b: number
  if (c <= 0.5) {
    const t = c * 2
    r = Math.round(r1 + (r2 - r1) * t)
    g = Math.round(g1 + (g2 - g1) * t)
    b = Math.round(b1 + (b2 - b1) * t)
  } else {
    const t = (c - 0.5) * 2
    r = Math.round(r2 + (r3 - r2) * t)
    g = Math.round(g2 + (g3 - g2) * t)
    b = Math.round(b2 + (b3 - b2) * t)
  }
  return `rgb(${r}, ${g}, ${b})`
}

/** Цвет по коэффициенту KPI — один стандарт для контура, текста и прогресс-бара */
export function getKpiBorderColor(coefficient: number): string {
  const c = Math.max(0, Math.min(1, coefficient))
  return interpolateKpiColor(c)
}

/** Тот же цвет, что и контур/текст (единая палитра) */
export function getKpiProgressColor(coefficient: number): string {
  return getKpiBorderColor(coefficient)
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
