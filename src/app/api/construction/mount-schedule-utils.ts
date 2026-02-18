/** Сумма для отображения: amountCurrent ?? amountNext */
export function getAmountDisplay(entry: {
  amountCurrent?: unknown
  amountNext?: unknown
}): number | null {
  const toNum = (v: unknown): number | null => {
    if (v == null) return null
    if (typeof v === "number" && !Number.isNaN(v)) return v
    if (typeof v === "object" && v !== null && "toNumber" in (v as object))
      return (v as { toNumber: () => number }).toNumber()
    return null
  }
  return toNum(entry.amountCurrent) ?? toNum(entry.amountNext) ?? null
}

/** Краткий статус: переопределение или сборка из дат/полей (даты — Date или ISO-строка из Supabase) */
export function getStatusSummary(entry: {
  statusSummaryOverride?: string | null
  productionStatus?: string | null
  productionLaunchDate?: Date | string | null
  shipmentDate?: Date | string | null
  roofWorkDate?: Date | string | null
  handoverDate?: Date | string | null
}): string {
  const override = entry.statusSummaryOverride?.trim()
  if (override) return override
  const parts: string[] = []
  if (entry.productionStatus) parts.push(entry.productionStatus)
  const fmt = (d: Date | string | null | undefined) => {
    if (!d) return null
    const date = typeof d === "string" ? new Date(d) : d
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
  }
  if (entry.productionLaunchDate) parts.push(`Запуск: ${fmt(entry.productionLaunchDate)}`)
  if (entry.shipmentDate) parts.push(`Отгрузка: ${fmt(entry.shipmentDate)}`)
  if (entry.roofWorkDate) parts.push(`Кровля: ${fmt(entry.roofWorkDate)}`)
  if (entry.handoverDate) parts.push(`Сдача: ${fmt(entry.handoverDate)}`)
  return parts.length ? parts.join(". ") : "—"
}

/** Строка адреса для отображения: fullText или сборка из полей (объект из Supabase/Prisma) */
export function getAddressDisplay(addr: { fullText?: string | null; region?: string | null; district?: string | null; locality?: string | null; street?: string | null; house?: string | null } | null | undefined): string | null {
  if (!addr) return null
  if (addr.fullText?.trim()) return addr.fullText.trim()
  const parts = [addr.region, addr.district, addr.locality, addr.street, addr.house].filter(Boolean) as string[]
  return parts.length ? parts.join(", ") : null
}
