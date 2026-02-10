import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWarehouseBalances, getWarehouses } from "@/integrations/1c"

/** Код основного склада — доступный остаток считается только по нему (списание с основного на склад производства). warehouses/get/list: 000000007 = «Основной склад (Зайцева)». */
const MAIN_WAREHOUSE_CODE = "000000007"

type TreeNode = {
  Код?: string
  Наименование?: string
  ЭтоГруппа?: boolean
  Дети?: TreeNode[]
  Остатки?: { Склад: string; Количество: number }[]
  [key: string]: unknown
}

/** В 1С в Остатках поле Склад — наименование склада. Находим наименование по коду. */
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

/** Оставить в дереве только остатки по основному складу; у листьев — один элемент Остатки с суммой по основному. */
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

/**
 * GET /api/1c/warehouse/balances
 * Получает складские остатки из 1С только по основному складу (код 7).
 * Доступный остаток = только основной склад; списание идёт с него на склад производства.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const metadata = user.user_metadata || {}

    const integrations = metadata.integrations as Record<string, unknown> | undefined
    const oneC = integrations?.["1c"] as { enabled: boolean } | undefined

    if (!oneC?.enabled) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена. Настройте в разделе Настройки → Интеграции." },
        { status: 400 }
      )
    }

    const [rawBalances, rawWarehouses] = await Promise.all([
      getWarehouseBalances(metadata),
      getWarehouses(metadata),
    ])
    const warehouses = Array.isArray(rawWarehouses) ? rawWarehouses : []
    const mainName = getMainWarehouseName(warehouses)
    const tree = Array.isArray(rawBalances) ? rawBalances : []

    const data = mainName ? filterTreeByMainWarehouse(tree as TreeNode[], mainName) : tree

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Ошибка получения складских остатков:", error)

    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"

    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
