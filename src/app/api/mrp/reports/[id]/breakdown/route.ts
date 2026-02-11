import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSpecifications } from "@/integrations/1c"
import { roundMaterialQty } from "@/lib/utils"

/** Нормализация кода для сопоставления (trim + убрать ведущие нули), чтобы 00000018218 и 18218 совпадали */
function normalizeMaterialCode(code: string): string {
  const s = code.trim()
  const withoutLeadingZeros = s.replace(/^0+/, "") || s
  return withoutLeadingZeros
}

/** Извлечь из спецификации материалы: код и количество (для поиска по коду материала) */
function getMaterialQuantities(spec: Record<string, unknown>): { code: string; qty: number }[] {
  const raw = spec.Материалы ?? spec.Materials
  if (!Array.isArray(raw)) return []
  const out: { code: string; qty: number }[] = []
  for (const row of raw) {
    const r = row as Record<string, unknown>
    const code = String(r.Код ?? r.Code ?? "").trim()
    if (!code) continue
    let qty = 0
    if (typeof r.Количество === "number") qty = r.Количество
    else if (typeof r.Quantity === "number") qty = r.Quantity
    else if (typeof r.Количество === "string") qty = parseFloat(r.Количество) || 0
    out.push({ code, qty })
  }
  return out
}

/**
 * GET /api/mrp/reports/[id]/breakdown?materialCode=...
 * Разбивка по спецификациям: в каких спецификациях и сколько заложено данного материала.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { id: reportId } = await params
    const materialCodeParam = request.nextUrl.searchParams.get("materialCode")?.trim()
    if (!materialCodeParam) {
      return NextResponse.json({ error: "Не указан materialCode" }, { status: 400 })
    }
    const materialCodeNorm = normalizeMaterialCode(materialCodeParam)

    const { data: report } = await supabase
      .from("mrp_report")
      .select("id")
      .eq("id", reportId)
      .eq("userId", user.id)
      .single()

    if (!report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    const { data: specifications } = await supabase
      .from("mrp_report_specification")
      .select("specificationCode, specificationName")
      .eq("reportId", reportId)

    const specList = specifications ?? []
    const metadata = user.user_metadata ?? {}
    const breakdown: { specificationCode: string; specificationName: string | null; quantity: number }[] = []

    for (const spec of specList) {
      const raw = await getSpecifications(metadata, { code: spec.specificationCode, full: true }) as unknown[] | { data?: unknown[] } | null | undefined
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Array.isArray(raw.data)) ? raw.data : []
      const one = list[0] as Record<string, unknown> | undefined
      if (!one) continue
      const materials = getMaterialQuantities(one)
      // Суммируем ВСЕ вхождения материала в спецификации (может быть несколько строк с одним кодом)
      const totalQty = roundMaterialQty(
        materials
          .filter((m) => normalizeMaterialCode(m.code) === materialCodeNorm)
          .reduce((sum, m) => sum + m.qty, 0)
      )
      if (totalQty > 0) {
        breakdown.push({
          specificationCode: spec.specificationCode,
          specificationName: spec.specificationName ?? null,
          quantity: totalQty,
        })
      }
    }

    return NextResponse.json({ data: breakdown })
  } catch (error) {
    console.error("[GET /api/mrp/reports/[id]/breakdown]", error)
    const message = error instanceof Error ? error.message : "Ошибка"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
