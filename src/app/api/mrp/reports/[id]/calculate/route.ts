import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSpecifications, getWarehouseBalances, getWarehouses } from "@/integrations/1c"
import { randomUUID } from "crypto"

const MAIN_WAREHOUSE_CODE = "000000007"

type TreeNode = {
  Код?: string
  Наименование?: string
  ЕдиницаИзмерения?: string
  ЭтоГруппа?: boolean
  Дети?: TreeNode[]
  Остатки?: { Склад: string; Количество: number }[]
}

function getMainWarehouseName(warehouses: { Код?: string; Наименование?: string }[]): string | null {
  const codeNorm = MAIN_WAREHOUSE_CODE.replace(/^0+/, "") || MAIN_WAREHOUSE_CODE
  for (const w of warehouses) {
    const c = String(w.Код ?? "").replace(/^0+/, "") || String(w.Код ?? "")
    if (c === codeNorm || c === MAIN_WAREHOUSE_CODE) {
      const name = String(w.Наименование ?? "").trim()
      return name || null
    }
  }
  return null
}

function filterTreeByMainWarehouse(nodes: TreeNode[] | null | undefined, mainWarehouseName: string): TreeNode[] {
  if (!nodes?.length) return []
  return nodes.map((node) => {
    if (node.ЭтоГруппа && Array.isArray(node.Дети)) {
      return { ...node, Дети: filterTreeByMainWarehouse(node.Дети, mainWarehouseName) }
    }
    const rests = node.Остатки ?? []
    const mainOnly = rests.filter((r) => String(r.Склад ?? "").trim() === mainWarehouseName)
    const qty = mainOnly.reduce((s, r) => s + r.Количество, 0)
    return {
      ...node,
      Остатки: mainWarehouseName ? [{ Склад: mainWarehouseName, Количество: qty }] : [],
    }
  })
}

function flattenBalancesToMap(nodes: TreeNode[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!nodes?.length) return map
  for (const node of nodes) {
    if (node.ЭтоГруппа && Array.isArray(node.Дети)) {
      const childMap = flattenBalancesToMap(node.Дети)
      childMap.forEach((qty, code) => map.set(code, (map.get(code) ?? 0) + qty))
    } else {
      const code = String(node.Код ?? "").trim()
      if (!code) continue
      const qty = (node.Остатки ?? []).reduce((s, r) => s + r.Количество, 0)
      map.set(code, (map.get(code) ?? 0) + qty)
    }
  }
  return map
}

/** Собрать из дерева остатков карту код → наименование (и ед.изм.) из номенклатуры 1С. */
function buildCodeToNameAndUnit(nodes: TreeNode[] | null | undefined): { name: Map<string, string>; unit: Map<string, string> } {
  const name = new Map<string, string>()
  const unit = new Map<string, string>()
  if (!nodes?.length) return { name, unit }
  for (const node of nodes) {
    if (node.ЭтоГруппа && Array.isArray(node.Дети)) {
      const child = buildCodeToNameAndUnit(node.Дети)
      child.name.forEach((v, k) => name.set(k, v))
      child.unit.forEach((v, k) => unit.set(k, v))
    } else {
      const code = String(node.Код ?? "").trim()
      if (!code) continue
      const n = String(node.Наименование ?? "").trim()
      if (n) name.set(code, n)
      const u = String(node.ЕдиницаИзмерения ?? "").trim()
      if (u) unit.set(code, u)
    }
  }
  return { name, unit }
}

/** Номенклатурная группа из строки материала (1С может отдавать разными ключами) */
function getNomenclatureGroup(r: Record<string, unknown>): string | undefined {
  const v =
    r.НоменклатурнаяГруппа ??
    (r as Record<string, unknown>).NomenclatureGroup ??
    (r as Record<string, unknown>).номенклатурнаяГруппа
  const s = typeof v === "string" ? v.trim() : ""
  return s || undefined
}

function extractMaterials(spec: Record<string, unknown>): { code: string; name: string; qty: number; unit?: string; nomenclatureGroup?: string }[] {
  const raw = spec.Материалы ?? spec.Materials
  if (!Array.isArray(raw)) return []
  const out: { code: string; name: string; qty: number; unit?: string; nomenclatureGroup?: string }[] = []
  for (const row of raw) {
    const r = row as Record<string, unknown>
    const code = String(r.Код ?? r.Code ?? "").trim()
    if (!code) continue
    const name = String(r.Наименование ?? r.Name ?? "").trim() || code
    let qty = 0
    if (typeof r.Количество === "number") qty = r.Количество
    else if (typeof r.Quantity === "number") qty = r.Quantity
    else if (typeof r.Количество === "string") qty = parseFloat(r.Количество) || 0
    const unit = typeof r.ЕдиницаИзмерения === "string" ? r.ЕдиницаИзмерения : typeof r.Unit === "string" ? r.Unit : undefined
    const nomenclatureGroup = getNomenclatureGroup(r)
    out.push({ code, name, qty, unit, nomenclatureGroup: nomenclatureGroup || undefined })
  }
  return out
}

/**
 * POST /api/mrp/reports/[id]/calculate
 * Выполнить расчёт MRP: агрегация потребности по спецификациям, остатки по кодам, объём к закупке.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const metadata = user.user_metadata ?? {}
    const { id: reportId } = await params

    const { data: report, error: reportError } = await supabase
      .from("mrp_report")
      .select("*")
      .eq("id", reportId)
      .eq("userId", user.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Расчёт выполняется только для черновика" },
        { status: 400 }
      )
    }

    const { data: specifications } = await supabase
      .from("mrp_report_specification")
      .select("*")
      .eq("reportId", reportId)

    const specList = specifications ?? []
    if (specList.length === 0) {
      return NextResponse.json(
        { error: "Добавьте хотя бы одну спецификацию" },
        { status: 400 }
      )
    }

    const demandByCode = new Map<string, { name: string; unit?: string; nomenclatureGroup?: string; qty: number }>()

    for (const spec of specList) {
      const raw = await getSpecifications(metadata, { code: spec.specificationCode, full: true }) as unknown[] | { data?: unknown[] } | null | undefined
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Array.isArray(raw.data)) ? raw.data : []
      const one = list[0] as Record<string, unknown> | undefined
      if (!one) continue
      const materials = extractMaterials(one)
      for (const m of materials) {
        const cur = demandByCode.get(m.code)
        if (cur) {
          cur.qty += m.qty
        } else {
          demandByCode.set(m.code, { name: m.name, unit: m.unit, nomenclatureGroup: m.nomenclatureGroup, qty: m.qty })
        }
      }
    }

    const [rawBalances, rawWarehouses] = await Promise.all([
      getWarehouseBalances(metadata),
      getWarehouses(metadata),
    ])
    const warehouses = Array.isArray(rawWarehouses) ? rawWarehouses : []
    const mainName = getMainWarehouseName(warehouses)
    const tree = Array.isArray(rawBalances) ? rawBalances : []
    const filteredTree = mainName ? filterTreeByMainWarehouse(tree as TreeNode[], mainName) : (tree as TreeNode[])
    const balanceByCode = flattenBalancesToMap(filteredTree)
    const { name: codeToName, unit: codeToUnit } = buildCodeToNameAndUnit(filteredTree)

    const results: { materialCode: string; materialName: string; unit: string | null; nomenclatureGroup: string | null; demandQty: number; balanceQty: number; purchaseQty: number }[] = []
    for (const [code, d] of demandByCode) {
      const balanceQty = balanceByCode.get(code) ?? 0
      const purchaseQty = Math.max(0, d.qty - balanceQty)
      const materialName = codeToName.get(code) ?? d.name
      const materialUnit = codeToUnit.get(code) ?? d.unit ?? null
      results.push({
        materialCode: code,
        materialName,
        unit: materialUnit,
        nomenclatureGroup: d.nomenclatureGroup ?? null,
        demandQty: d.qty,
        balanceQty,
        purchaseQty,
      })
    }

    await supabase.from("mrp_report_result").delete().eq("reportId", reportId)

    if (results.length > 0) {
      const rows = results.map((r) => ({
        id: randomUUID(),
        reportId,
        materialCode: r.materialCode,
        materialName: r.materialName,
        unit: r.unit,
        nomenclatureGroup: r.nomenclatureGroup,
        demandQty: r.demandQty,
        balanceQty: r.balanceQty,
        purchaseQty: r.purchaseQty,
      }))
      const { error: insertError } = await supabase.from("mrp_report_result").insert(rows)
      if (insertError) {
        console.error("[POST /api/mrp/reports/[id]/calculate] insert results error:", insertError)
        return NextResponse.json(
          { error: "Ошибка сохранения результатов" },
          { status: 500 }
        )
      }
    }

    await supabase
      .from("mrp_report")
      .update({ status: "computed", updatedAt: new Date().toISOString() })
      .eq("id", reportId)
      .eq("userId", user.id)

    const reportTitle = report.title ?? ""
    if (reportTitle) {
      const { data: sameTitleDrafts } = await supabase
        .from("mrp_report")
        .select("id")
        .eq("userId", user.id)
        .eq("title", reportTitle)
        .eq("status", "draft")
        .neq("id", reportId)
      const toDelete = (sameTitleDrafts ?? []).map((r) => r.id)
      for (const id of toDelete) {
        await supabase.from("mrp_report").delete().eq("id", id)
      }
    }

    const [updatedReport, specsRes, resultsRes] = await Promise.all([
      supabase.from("mrp_report").select("*").eq("id", reportId).eq("userId", user.id).single(),
      supabase.from("mrp_report_specification").select("*").eq("reportId", reportId),
      supabase.from("mrp_report_result").select("*").eq("reportId", reportId),
    ])

    const data = {
      ...updatedReport.data,
      specifications: specsRes.data ?? [],
      results: resultsRes.data ?? [],
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[POST /api/mrp/reports/[id]/calculate]", error)
    const message = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Ошибка расчёта: ${message}` },
      { status: 500 }
    )
  }
}
