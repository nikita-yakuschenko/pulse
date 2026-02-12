/**
 * Типы и моковые данные для мониторинга KPI отдела закупок.
 * Основа: docs/kpi-spec.md
 */

export const KPI_WEIGHTS = {
  budget: 0.3,
  urgent: 0.15,
  leadtime: 0.05,
  quality: 0.1,
  ontime: 0.2,
  savings: 0.1,
  suppliers: 0.1,
} as const

export const KPI_LABELS: Record<keyof typeof KPI_WEIGHTS, string> = {
  budget: "Соблюдение бюджета",
  urgent: "Доля срочных закупок",
  leadtime: "Срок закупки",
  quality: "Доля брака и возвратов",
  ontime: "Своевременность поставок",
  savings: "Экономия на закупках",
  suppliers: "Качество работы с поставщиками",
}

export type KpiCode = keyof typeof KPI_WEIGHTS

export interface KpiMetric {
  code: KpiCode
  label: string
  /** Значение показателя в % (для отображения) */
  percentValue: number
  /** Коэффициент 0–1 для расчёта общего KPI */
  coefficient: number
  /** Краткое пояснение или доп. число (опционально) */
  hint?: string
}

export interface KpiSummary {
  /** Общий коэффициент эффективности 0–1 */
  totalCoefficient: number
  /** База мотивации, руб */
  motivationBase: number
  /** Итоговая мотивация, руб */
  motivationAmount: number
  /** Период (для подписи) */
  periodLabel: string
}

/** Динамика общего KPI по месяцам (для графика) */
export interface KpiTrendPoint {
  month: string
  value: number
  label: string
}

/** Мок: текущие метрики по 7 KPI (пример из kpi-spec) */
export const MOCK_KPI_METRICS: KpiMetric[] = [
  {
    code: "budget",
    label: KPI_LABELS.budget,
    percentValue: 105,
    coefficient: 0.95,
    hint: "План 40 млн ₽, факт 42 млн ₽",
  },
  {
    code: "urgent",
    label: KPI_LABELS.urgent,
    percentValue: 14.23,
    coefficient: 0.857,
    hint: "37 внеплановых из 260 закупок",
  },
  {
    code: "leadtime",
    label: KPI_LABELS.leadtime,
    percentValue: 160,
    coefficient: 0.4,
    hint: "Средний срок 8 дн при норме 5 дн",
  },
  {
    code: "quality",
    label: KPI_LABELS.quality,
    percentValue: 99.99,
    coefficient: 0.999,
    hint: "Доля поставок без брака",
  },
  {
    code: "ontime",
    label: KPI_LABELS.ontime,
    percentValue: 86.7,
    coefficient: 0.867,
    hint: "26 из 30 поставок в срок",
  },
  {
    code: "savings",
    label: KPI_LABELS.savings,
    percentValue: 84.6,
    coefficient: 0.846,
    hint: "Экономия 1,06% при цели 1,3%",
  },
  {
    code: "suppliers",
    label: KPI_LABELS.suppliers,
    percentValue: 80,
    coefficient: 0.8,
    hint: "4 улучшения из 5 по плану",
  },
]

/** Мок: сводка за период */
export const MOCK_KPI_SUMMARY: KpiSummary = {
  totalCoefficient: 0.87145,
  motivationBase: 100_000,
  motivationAmount: 87_145,
  periodLabel: "Февраль 2025",
}

/** Мок: динамика общего KPI за последние 6 месяцев */
export const MOCK_KPI_TREND: KpiTrendPoint[] = [
  { month: "сен", value: 0.82, label: "Сентябрь" },
  { month: "окт", value: 0.84, label: "Октябрь" },
  { month: "ноя", value: 0.79, label: "Ноябрь" },
  { month: "дек", value: 0.85, label: "Декабрь" },
  { month: "янв", value: 0.83, label: "Январь" },
  { month: "фев", value: 0.87145, label: "Февраль" },
]
