import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWarehouseBalances, getWarehouses } from "@/integrations/1c"

type MaterialTreeNode = {
  Код?: string
  Наименование?: string
  ЭтоГруппа?: boolean
  ЕдиницаИзмерения?: string
  Дети?: MaterialTreeNode[]
  Остатки?: { Склад: string; Количество: number }[]
}

/** В Остатках поле Склад — это наименование, а в warehouseCodes — коды. Нужна карта код→наименование. */
function buildWarehouseCodeToName(warehouses: { Код?: string; Наименование?: string }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const w of warehouses) {
    const code = String(w.Код ?? "")
    const name = String(w.Наименование ?? "").trim()
    if (code && name) map.set(code, name)
  }
  return map
}

/** Собрать карту Код -> суммарное количество из дерева balances.
 * warehouseCodes: коды складов; фильтруем по наименованиям (Склад в Остатках — это название).
 */
function flattenBalancesToMap(
  nodes: MaterialTreeNode[] | null | undefined,
  warehouseCodes: string[] | null,
  codeToName: Map<string, string>
): Map<string, number> {
  const map = new Map<string, number>()
  if (!nodes?.length) return map

  const allowedNames =
    Array.isArray(warehouseCodes) && warehouseCodes.length > 0
      ? new Set(
          warehouseCodes
            .map((c) => codeToName.get(String(c)) ?? "")
            .filter(Boolean)
        )
      : null

  for (const node of nodes) {
    if (node.ЭтоГруппа) {
      const childMap = flattenBalancesToMap(node.Дети, warehouseCodes, codeToName)
      for (const [code, qty] of childMap) {
        map.set(code, (map.get(code) ?? 0) + qty)
      }
    } else if (node.Код) {
      const rests = node.Остатки ?? []
      const total =
        allowedNames && allowedNames.size > 0
          ? rests
              .filter((r) => allowedNames.has(String(r.Склад ?? "").trim()))
              .reduce((s, r) => s + r.Количество, 0)
          : rests.reduce((s, r) => s + r.Количество, 0)
      map.set(node.Код, (map.get(node.Код) ?? 0) + total)
    }
  }
  return map
}

export interface ReorderAlertItem {
  id: string
  itemName: string
  itemCode: string
  itemCodes?: string[]
  isGroup: boolean
  currentQty: number
  reorderQuantity: number
  unit?: string | null
}

/**
 * GET /api/warehouse/reorder-alerts
 * Возвращает точки заказа, у которых остаток <= точки заказа (наступившая точка).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const metadata = (user.user_metadata || {}) as Record<string, unknown>
    const integrations = metadata.integrations as Record<string, unknown> | undefined
    const oneC = integrations?.["1c"] as { enabled?: boolean } | undefined

    if (!oneC?.enabled) {
      return NextResponse.json({ count: 0, items: [] })
    }

    const [{ data: reorderPoints }, rawBalances, rawWarehouses] = await Promise.all([
      supabase
        .from("reorder_point")
        .select("*")
        .eq("userId", user.id)
        .order("itemName", { ascending: true }),
      getWarehouseBalances(metadata),
      getWarehouses(metadata).catch(() => []),
    ])

    const tree = Array.isArray(rawBalances) ? rawBalances : []
    const warehousesList = Array.isArray(rawWarehouses) ? rawWarehouses : []
    const codeToName = buildWarehouseCodeToName(warehousesList)

    const items: ReorderAlertItem[] = []
    for (const point of reorderPoints || []) {
      const warehouseCodes = Array.isArray(point.warehouseCodes) && point.warehouseCodes.length > 0
        ? point.warehouseCodes
        : null
      const balancesMap = flattenBalancesToMap(tree as MaterialTreeNode[], warehouseCodes, codeToName)

      const codes =
        point.isGroup && Array.isArray(point.itemCodes)
          ? point.itemCodes
          : [point.itemCode]
      const totalQty = codes.reduce(
        (s: number, c: string | number) => s + (balancesMap.get(String(c)) ?? 0),
        0
      )
      const reorderQty = Number(point.reorderQuantity)
      if (totalQty <= reorderQty) {
        items.push({
          id: point.id,
          itemName: point.itemName,
          itemCode: point.itemCode ?? "",
          itemCodes: point.itemCodes ?? undefined,
          isGroup: !!point.isGroup,
          currentQty: totalQty,
          reorderQuantity: reorderQty,
          unit: point.unit ?? null,
        })
      }
    }

    return NextResponse.json({ count: items.length, items })
  } catch (error) {
    console.error("[GET /api/warehouse/reorder-alerts]", error)
    return NextResponse.json(
      { error: "Ошибка загрузки уведомлений", count: 0, items: [] },
      { status: 500 }
    )
  }
}
