"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconBookmark,
  IconBox,
  IconBuildingWarehouse,
  IconCaretDownFilled,
  IconCaretUpFilled,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconHome,
  IconLoader,
  IconList,
  IconMathAvg,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { WarehouseBalance, MaterialTreeNode } from "@/types/1c"
import { cn, formatMaterialQty, formatUnit } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200] as const
const STORAGE_KEY = "warehouse-balance-page-size"
const TAB_STORAGE_KEY = "warehouse-balance-tab"

/** Совпадение по полному или частичному наименованию (без учёта регистра) */
function nodeMatchesSearch(node: MaterialTreeNode, query: string): boolean {
  if (!query.trim()) return true
  const name = (node.Наименование ?? "").toLowerCase()
  return name.includes(query.trim().toLowerCase())
}

/** Собрать из дерева только материалы (не группы), у которых наименование совпадает с запросом. Сквозной поиск. */
function collectMatchingMaterials(nodes: MaterialTreeNode[] | null | undefined, query: string): MaterialTreeNode[] {
  if (!nodes?.length || !query.trim()) return []
  const q = query.trim().toLowerCase()
  const result: MaterialTreeNode[] = []
  for (const node of nodes) {
    if (node.ЭтоГруппа) {
      result.push(...collectMatchingMaterials(node.Дети, query))
    } else if (
      (node.Наименование ?? "").toLowerCase().includes(q) ||
      (node.Код ?? "").toLowerCase().includes(q)
    ) {
      result.push(node)
    }
  }
  return result
}

/** Код номенклатурной группы «Материалы» — в точке заказа отображаем только её и её поддерево */
const MATERIALS_GROUP_CODE = "00000007716"

/** Найти узел в дереве по коду */
function findNodeByCode(nodes: MaterialTreeNode[] | null | undefined, code: string): MaterialTreeNode | undefined {
  if (!nodes?.length) return undefined
  for (const n of nodes) {
    if (n.Код === code) return n
    if (n.ЭтоГруппа) {
      const found = findNodeByCode(n.Дети, code)
      if (found) return found
    }
  }
  return undefined
}

/** Собрать все коды материалов (не групп) из поддерева */
function collectAllMaterialCodes(nodes: MaterialTreeNode[] | null | undefined): string[] {
  if (!nodes?.length) return []
  const codes: string[] = []
  for (const node of nodes) {
    if (node.ЭтоГруппа) {
      codes.push(...collectAllMaterialCodes(node.Дети))
    } else if (node.Код) {
      codes.push(node.Код)
    }
  }
  return codes
}

function sortMaterialsTreeByName(nodes: MaterialTreeNode[]): MaterialTreeNode[] {
  return [...nodes]
    .sort((a, b) => (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru"))
    .map((node) => {
      if (node.Дети?.length) {
        return { ...node, Дети: sortMaterialsTreeByName(node.Дети) }
      }
      return node
    })
}

/** Развернуть дерево balances в плоский массив {Код, Наименование, ЕдиницаИзмерения, Количество, Склад} для совместимости */
function flattenBalancesTree(nodes: MaterialTreeNode[] | null | undefined): WarehouseBalance[] {
  if (!nodes?.length) return []
  const result: WarehouseBalance[] = []
  for (const node of nodes) {
    if (node.ЭтоГруппа) {
      result.push(...flattenBalancesTree(node.Дети))
    } else {
      const rests = node.Остатки ?? []
      if (rests.length > 0) {
        for (const r of rests) {
          result.push({
            Код: node.Код,
            Номенклатура: node.Наименование ?? node.Код ?? "",
            ЕдиницаИзмерения: node.ЕдиницаИзмерения ?? undefined,
            Количество: r.Количество,
            Склад: r.Склад ?? "",
          })
        }
      } else {
        result.push({
          Код: node.Код,
          Номенклатура: node.Наименование ?? node.Код ?? "",
          ЕдиницаИзмерения: node.ЕдиницаИзмерения ?? undefined,
          Количество: 0,
          Склад: "",
        })
      }
    }
  }
  return result
}

interface ReorderPoint {
  id: string
  itemCode: string
  itemName: string
  reorderQuantity: number
  unit?: string | null
  isGroup?: boolean
  itemCodes?: string[] | null
  warehouseCodes?: string[] | null
}

/** Остатки с учётом складов точки заказа. В Остатках Склад — наименование, в warehouseCodes — коды. */
function filterBalancesByWarehouses(
  balances: WarehouseBalance[],
  warehouseCodes: string[] | null | undefined,
  warehouses: { Код?: string; Наименование?: string }[]
): WarehouseBalance[] {
  if (!Array.isArray(warehouseCodes) || warehouseCodes.length === 0) return balances
  const codeToName = new Map(
    warehouses
      .filter((w) => w.Код && w.Наименование)
      .map((w) => [String(w.Код), String(w.Наименование).trim()])
  )
  const allowedNames = new Set(
    warehouseCodes.map((c) => codeToName.get(String(c)) ?? "").filter(Boolean)
  )
  if (allowedNames.size === 0) return balances
  return balances.filter((r) => allowedNames.has(String(r.Склад ?? "").trim()))
}

/** Рекурсивный узел дерева для мультиселекта материалов (мемоизирован для снижения лагов при вводе в другие поля диалога) */
const GroupTreeNode = React.memo(function GroupTreeNode({
  node,
  depth,
  selectedCodes,
  setSelectedCodes,
  searchQuery,
}: {
  node: MaterialTreeNode
  depth: number
  selectedCodes: string[]
  setSelectedCodes: React.Dispatch<React.SetStateAction<string[]>>
  searchQuery: string
}) {
  const q = searchQuery.trim().toLowerCase()
  const hasSearch = q.length > 0
  const [collapsed, setCollapsed] = React.useState(true) // все группы свёрнуты по умолчанию

  // При поиске автоматически раскрываем группы
  const isCollapsed = hasSearch ? false : collapsed

  if (node.ЭтоГруппа) {
    const allCodes = collectAllMaterialCodes(node.Дети)
    if (allCodes.length === 0) return null

    // При активном поиске проверяем, есть ли совпадения внутри группы
    if (q) {
      const flat = collectMatchingMaterials(node.Дети, searchQuery)
      if (flat.length === 0) return null
    }

    const allChecked = allCodes.every((c) => selectedCodes.includes(c))
    const someChecked = !allChecked && allCodes.some((c) => selectedCodes.includes(c))
    const paddingLeft = depth * 20 + 12

    const children = [...(node.Дети ?? [])]
      .sort((a, b) => {
        // Группы первые, потом материалы
        if (a.ЭтоГруппа && !b.ЭтоГруппа) return -1
        if (!a.ЭтоГруппа && b.ЭтоГруппа) return 1
        return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
      })

    return (
      <div>
        <div
          className="flex items-center gap-2 py-1.5 pr-3 cursor-pointer text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors select-none border-b"
          style={{ paddingLeft }}
          onClick={() => setCollapsed((v) => !v)}
        >
          <IconChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isCollapsed && "rotate-90")} />
          <span
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={() => {
                setSelectedCodes((prev) => {
                  if (allChecked) {
                    return prev.filter((c) => !allCodes.includes(c))
                  }
                  const set = new Set(prev)
                  for (const c of allCodes) set.add(c)
                  return [...set]
                })
              }}
            />
          </span>
          <IconFolder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.Наименование}</span>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{allCodes.length}</span>
        </div>
        {!isCollapsed && children.map((child) => (
          <GroupTreeNode
            key={child.Код ?? child.Наименование}
            node={child}
            depth={depth + 1}
            selectedCodes={selectedCodes}
            setSelectedCodes={setSelectedCodes}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    )
  }

  // Материал (лист)
  if (!node.Код) return null
  // Фильтр по поиску
  if (q && !(node.Наименование ?? "").toLowerCase().includes(q) && !(node.Код ?? "").toLowerCase().includes(q)) {
    return null
  }
  const checked = selectedCodes.includes(node.Код)
  const paddingLeft = depth * 20 + 12
  return (
    <label
      className="flex items-center gap-2.5 pr-3 py-1.5 cursor-pointer text-sm hover:bg-muted/50 transition-colors select-none border-b last:border-b-0"
      style={{ paddingLeft }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => {
          setSelectedCodes((prev) =>
            checked ? prev.filter((c) => c !== node.Код) : [...prev, node.Код!]
          )
        }}
      />
      <span className="truncate">{node.Наименование}</span>
      <span className="ml-auto text-xs text-muted-foreground shrink-0">{node.Код}</span>
    </label>
  )
})

export function WarehouseBalanceView() {
  /** Дерево с остатками (ответ balances/get/list) — иерархия + Остатки по складам на листьях */
  const [balancesTree, setBalancesTree] = React.useState<MaterialTreeNode[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      const n = saved ? Number(saved) : 17
      return n >= 1 && n <= 500 ? n : 17
    }
    return 17
  })
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TAB_STORAGE_KEY)
      if (saved === "available" || saved === "reorder") return saved
    }
    return "available"
  })

  // При переходе по ссылке с ?tab=reorder — открывать вкладку «Точка заказа»
  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "reorder") setActiveTab("reorder")
  }, [searchParams])
  const [reorderPoints, setReorderPoints] = React.useState<ReorderPoint[]>([])
  const [reorderLoading, setReorderLoading] = React.useState(false)
  const [reorderError, setReorderError] = React.useState<string | null>(null)
  const [warehouses, setWarehouses] = React.useState<{ Код: string; Наименование?: string }[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [selectedCodes, setSelectedCodes] = React.useState<string[]>([])
  const [selectedWarehouseCodes, setSelectedWarehouseCodes] = React.useState<string[]>([])
  const [reorderQty, setReorderQty] = React.useState("")
  const [reorderName, setReorderName] = React.useState("")
  const [pickerSearch, setPickerSearch] = React.useState("")
  const [debouncedPickerSearch, setDebouncedPickerSearch] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<{ id: string; name: string } | null>(null)
  const [detailsPoint, setDetailsPoint] = React.useState<ReorderPoint | null>(null)
  const [editingPoint, setEditingPoint] = React.useState<ReorderPoint | null>(null)
  const [pageSizeSelectValue, setPageSizeSelectValue] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      const n = saved ? Number(saved) : 17
      return (PAGE_SIZE_PRESETS as readonly number[]).includes(n) ? String(n) : "custom"
    }
    return "17"
  })
  /** Дерево номенклатуры — берём из balancesTree (один источник) */
  const materialsTree = balancesTree
  const [materialsLoading, setMaterialsLoading] = React.useState(false)
  const [materialsError, setMaterialsError] = React.useState<string | null>(null)
  /** Стек провалов: текущий уровень = последний элемент .Дети или корень */
  const [drillPath, setDrillPath] = React.useState<MaterialTreeNode[]>([])
  /** Показывать номенклатуру с нулевым доступным остатком (по умолчанию скрыты) */
  const [showZeroBalances, setShowZeroBalances] = React.useState(false)
  /** Отображать скрытые группы (по умолчанию скрыты не показываем) */
  const [showHiddenGroups, setShowHiddenGroups] = React.useState(false)
  /** Живой поиск по наименованию на табе Доступный остаток (сквозной). Инпут привязан сюда — обновляется сразу. */
  const [materialSearchQuery, setMaterialSearchQuery] = React.useState("")
  /** Запрос для фильтрации: обновляется через 500 мс после последнего ввода (дебаунс). */
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("")
  /** Настройки групп: избранное и скрытие (по пользователю из API) */
  const [groupPrefs, setGroupPrefs] = React.useState<Record<string, { favorite: boolean; hidden: boolean }>>({})
  const [groupPrefsLoading, setGroupPrefsLoading] = React.useState(false)
  /** Избранные материалы (по пользователю из API) — отображаются вверху списка при провале в группу */
  const [materialPrefs, setMaterialPrefs] = React.useState<Record<string, { favorite: boolean }>>({})
  const [materialPrefsLoading, setMaterialPrefsLoading] = React.useState(false)

  // Дебаунс: фильтрация запускается не раньше чем через 500 мс после последнего символа
  React.useEffect(() => {
    if (materialSearchQuery === "") {
      setDebouncedSearchQuery("")
      return
    }
    const t = window.setTimeout(() => setDebouncedSearchQuery(materialSearchQuery), 500)
    return () => window.clearTimeout(t)
  }, [materialSearchQuery])

  // Дебаунс поиска в диалоге точки заказа (500 мс)
  React.useEffect(() => {
    if (pickerSearch === "") {
      setDebouncedPickerSearch("")
      return
    }
    const t = window.setTimeout(() => setDebouncedPickerSearch(pickerSearch), 500)
    return () => window.clearTimeout(t)
  }, [pickerSearch])

  // Для диалога точки заказа: внутренняя структура группы «Материалы» (00000007716) — показываем сразу подпапки, без самой группы
  const reorderPickerTree = React.useMemo(() => {
    const root = findNodeByCode(materialsTree ?? [], MATERIALS_GROUP_CODE)
    return root?.Дети ?? []
  }, [materialsTree])

  /** Плоский массив остатков для KPI и таблицы (развёрнут из дерева) */
  const balances = React.useMemo(
    () => flattenBalancesTree(balancesTree),
    [balancesTree]
  )
  const isSearchPending = materialSearchQuery !== debouncedSearchQuery

  // Текущий уровень для отображения (только дети текущей "папки" или корень), отсортированный по наименованию
  const currentLevel = React.useMemo(() => {
    const list = drillPath.length === 0
      ? (materialsTree ?? [])
      : (drillPath[drillPath.length - 1].Дети ?? [])
    return [...list].sort((a, b) => {
      const aGroup = a.ЭтоГруппа ? 1 : 0
      const bGroup = b.ЭтоГруппа ? 1 : 0
      if (aGroup !== bGroup) return bGroup - aGroup
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [materialsTree, drillPath])

  // Режим поиска: только материалы с совпадением по наименованию или коду по всему дереву, без групп; нулевые остатки не скрываем
  // Ранжирование: ненулевой остаток → избранные → для цифровых запросов: совпадение по названию важнее, чем по коду → алфавит
  const searchResults = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return null
    const q = debouncedSearchQuery.trim().toLowerCase()
    const isNumeric = /^\d+$/.test(q)
    const flat = collectMatchingMaterials(materialsTree ?? [], debouncedSearchQuery)
    return [...flat].sort((a, b) => {
      const qtyA = balances.filter((r) => r.Код === a.Код).reduce((s, r) => s + r.Количество, 0)
      const qtyB = balances.filter((r) => r.Код === b.Код).reduce((s, r) => s + r.Количество, 0)
      const hasStockA = qtyA > 0 ? 1 : 0
      const hasStockB = qtyB > 0 ? 1 : 0
      if (hasStockA !== hasStockB) return hasStockB - hasStockA // сначала с остатком
      const aFav = materialPrefs[a.Код ?? ""]?.favorite ? 1 : 0
      const bFav = materialPrefs[b.Код ?? ""]?.favorite ? 1 : 0
      if (aFav !== bFav) return bFav - aFav // избранные материалы вверху
      // Для цифровых запросов: совпадение по названию важнее, чем по коду
      if (isNumeric) {
        const aInName = (a.Наименование ?? "").toLowerCase().includes(q) ? 1 : 0
        const bInName = (b.Наименование ?? "").toLowerCase().includes(q) ? 1 : 0
        if (aInName !== bInName) return bInName - aInName
      }
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [materialsTree, debouncedSearchQuery, balances, materialPrefs])

  // Фильтр по скрытым группам (в обычном режиме; при поиске не используется)
  const levelAfterHidden = React.useMemo(() => {
    if (showHiddenGroups) return currentLevel
    return currentLevel.filter((node) => {
      if (!node.ЭтоГруппа) return true
      const pref = groupPrefs[node.Код ?? ""]
      return !pref?.hidden
    })
  }, [currentLevel, showHiddenGroups, groupPrefs])

  // Итоговый список: при активном поиске — найденные материалы (с учётом showZeroBalances); иначе — обычная цепочка фильтров
  const displayLevel = React.useMemo(() => {
    if (searchResults !== null) {
      if (!showZeroBalances) {
        return searchResults.filter((node) => {
          if (node.ЭтоГруппа) return true
          const totalQty = balances.filter((b) => b.Код === node.Код).reduce((s, r) => s + r.Количество, 0)
          return totalQty > 0
        })
      }
      return searchResults
    }
    const list = showZeroBalances
      ? levelAfterHidden
      : levelAfterHidden.filter((node) => {
          if (node.ЭтоГруппа) return true
          const totalQty = balances.filter((b) => b.Код === node.Код).reduce((s, r) => s + r.Количество, 0)
          return totalQty > 0
        })
    return [...list].sort((a, b) => {
      const aGroup = a.ЭтоГруппа ? 1 : 0
      const bGroup = b.ЭтоГруппа ? 1 : 0
      if (aGroup !== bGroup) return bGroup - aGroup
      // Избранное: для групп — groupPrefs, для материалов — materialPrefs
      const aFav = a.ЭтоГруппа ? (groupPrefs[a.Код ?? ""]?.favorite ? 1 : 0) : (materialPrefs[a.Код ?? ""]?.favorite ? 1 : 0)
      const bFav = b.ЭтоГруппа ? (groupPrefs[b.Код ?? ""]?.favorite ? 1 : 0) : (materialPrefs[b.Код ?? ""]?.favorite ? 1 : 0)
      if (aFav !== bFav) return bFav - aFav
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [searchResults, levelAfterHidden, showZeroBalances, balances, groupPrefs, materialPrefs])

  const drillInto = React.useCallback((node: MaterialTreeNode) => {
    setDrillPath((prev) => [...prev, node])
  }, [])

  const goHome = React.useCallback(() => {
    setMaterialSearchQuery("")
    setDrillPath([])
  }, [])

  /** Перейти к уровню в иерархии по индексу в drillPath (-1 = корень) */
  const drillTo = React.useCallback((index: number) => {
    if (index < 0) setDrillPath([])
    else setDrillPath((prev) => prev.slice(0, index + 1))
  }, [])

  /** Загрузить все настройки одним запросом (group prefs + material prefs) */
  const fetchAllPrefs = React.useCallback(async () => {
    setGroupPrefsLoading(true)
    setMaterialPrefsLoading(true)
    try {
      const res = await fetch("/api/warehouse/all-prefs?section=balance")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки")
      setGroupPrefs(json.groupPrefs ?? {})
      setMaterialPrefs(json.materialPrefs ?? {})
    } catch {
      setGroupPrefs({})
      setMaterialPrefs({})
    } finally {
      setGroupPrefsLoading(false)
      setMaterialPrefsLoading(false)
    }
  }, [])

  const setGroupPref = React.useCallback(
    async (groupCode: string, patch: { favorite?: boolean; hidden?: boolean }) => {
      try {
        const res = await fetch("/api/warehouse/material-group-prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupCode, section: "balance", ...patch }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Ошибка сохранения")
        setGroupPrefs((prev) => {
          const cur = prev[groupCode] ?? { favorite: false, hidden: false }
          const next = {
            favorite: patch.favorite ?? cur.favorite,
            hidden: patch.hidden ?? cur.hidden,
          }
          if (patch.hidden === true) next.favorite = false
          return { ...prev, [groupCode]: next }
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    },
    []
  )

  const setMaterialPref = React.useCallback(
    async (materialCode: string, patch: { favorite: boolean }) => {
      try {
        const res = await fetch("/api/warehouse/material-prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialCode, section: "balance", favorite: patch.favorite }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Ошибка сохранения")
        setMaterialPrefs((prev) => ({ ...prev, [materialCode]: { favorite: patch.favorite } }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    },
    []
  )

  React.useEffect(() => {
    if (activeTab === "available") {
      fetchAllPrefs()
    }
  }, [activeTab, fetchAllPrefs])

  const setPageSizeAndSave = React.useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(500, n))
    setPageSize(clamped)
    setPage(1)
    setPageSizeSelectValue((PAGE_SIZE_PRESETS as readonly number[]).includes(clamped) ? String(clamped) : "custom")
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }, [])

  const fetchReorderPoints = React.useCallback(async () => {
    setReorderLoading(true)
    setReorderError(null)
    try {
      const res = await fetch("/api/warehouse/reorder-points")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки")
      setReorderPoints(json.data ?? [])
    } catch (err) {
      setReorderError(err instanceof Error ? err.message : "Ошибка загрузки точек заказа")
    } finally {
      setReorderLoading(false)
    }
  }, [])

  const fetchWarehouses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/1c/warehouse/warehouses")
      const json = await res.json()
      if (res.ok && Array.isArray(json?.data)) {
        setWarehouses(json.data)
      }
    } catch {
      // игнорируем — склады не критичны для работы
    }
  }, [])

  const handleOpenDialog = React.useCallback((point?: ReorderPoint) => {
    if (point) {
      setEditingPoint(point)
      setSelectedCodes(point.itemCodes ?? (point.itemCode ? [point.itemCode] : []))
      setSelectedWarehouseCodes(Array.isArray(point.warehouseCodes) ? point.warehouseCodes : [])
      setReorderQty(String(point.reorderQuantity))
      setReorderName(point.itemName ?? "")
    } else {
      setEditingPoint(null)
      setSelectedCodes([])
      setSelectedWarehouseCodes([])
      setReorderQty("")
      setReorderName("")
    }
    setDialogOpen(true)
  }, [])

  /** Открыть диалог создания/редактирования точки заказа с предзаполненным материалом */
  const handleOpenDialogForMaterial = React.useCallback((code: string) => {
    const existing = reorderPoints.find(
      (rp) =>
        (!rp.isGroup && rp.itemCode === code) ||
        (rp.isGroup && rp.itemCodes?.includes(code))
    )
    if (existing) {
      setEditingPoint(existing)
      setSelectedCodes(existing.itemCodes ?? (existing.itemCode ? [existing.itemCode] : []))
      setSelectedWarehouseCodes(Array.isArray(existing.warehouseCodes) ? existing.warehouseCodes : [])
      setReorderQty(String(existing.reorderQuantity))
      setReorderName(existing.itemName ?? "")
    } else {
      setEditingPoint(null)
      setSelectedCodes([code])
      setSelectedWarehouseCodes([])
      setReorderQty("")
      setReorderName("")
    }
    setDialogOpen(true)
  }, [reorderPoints])

  const handleCloseDialog = React.useCallback(() => {
    setDialogOpen(false)
    setEditingPoint(null)
    setSelectedCodes([])
    setSelectedWarehouseCodes([])
    setReorderQty("")
    setReorderName("")
    setPickerSearch("")
    setDebouncedPickerSearch("")
  }, [])

  const handleAddReorderPoint = React.useCallback(async () => {
    const qty = Number(reorderQty)
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Введите корректное количество")
      return
    }

    if (selectedCodes.length < 1) {
      toast.error("Выберите минимум 1 материал")
      return
    }
    if (selectedCodes.length > 1 && !reorderName.trim()) {
      toast.error("Укажите название точки заказа")
      return
    }
    if (warehouses.length > 0 && selectedWarehouseCodes.length < 1) {
      toast.error("Выберите минимум 1 склад для отслеживания")
      return
    }

    setSubmitting(true)
    try {
      const findInTree = (code: string, nodes: MaterialTreeNode[] | null | undefined): MaterialTreeNode | undefined => {
        if (!nodes?.length) return undefined
        for (const n of nodes) {
          if (!n.ЭтоГруппа && n.Код === code) return n
          if (n.ЭтоГруппа) {
            const found = findInTree(code, n.Дети)
            if (found) return found
          }
        }
        return undefined
      }

      const firstCode = selectedCodes[0]!
      const firstBalance = balances.find((b) => b.Код === firstCode)
      const firstTreeItem = findInTree(firstCode, materialsTree)
      const itemName =
        selectedCodes.length > 1
          ? reorderName.trim()
          : firstBalance?.Номенклатура || firstTreeItem?.Наименование || firstCode

      const payload: Record<string, unknown> = {
        reorderQuantity: qty,
        isGroup: true,
        itemCodes: selectedCodes,
        itemName,
        unit: firstBalance?.ЕдиницаИзмерения ?? null,
        warehouseCodes: selectedWarehouseCodes,
      }

      if (editingPoint) {
        payload.id = editingPoint.id
      }

      const res = await fetch("/api/warehouse/reorder-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ошибка сохранения")

      toast.success(editingPoint ? "Точка заказа обновлена" : "Точка заказа добавлена")
      handleCloseDialog()
      await fetchReorderPoints()
      window.dispatchEvent(new CustomEvent("warehouse-reorder-updated"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setSubmitting(false)
    }
  }, [selectedCodes, selectedWarehouseCodes, warehouses.length, reorderQty, reorderName, balances, materialsTree, editingPoint, fetchReorderPoints, handleCloseDialog])

  const handleOpenDetailsAndEdit = React.useCallback((point: ReorderPoint) => {
    setDetailsPoint(null)
    handleOpenDialog(point)
  }, [handleOpenDialog])

  const handleDeleteReorderPoint = React.useCallback(async () => {
    if (!itemToDelete) return
    
    try {
      const res = await fetch("/api/warehouse/reorder-points", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemToDelete.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ошибка удаления")

      toast.success("Точка заказа удалена")
      setItemToDelete(null)
      await fetchReorderPoints()
      window.dispatchEvent(new CustomEvent("warehouse-reorder-updated"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления")
    }
  }, [itemToDelete, fetchReorderPoints])

  // Загрузка складов при открытии (для диалога точки заказа)
  React.useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  // Загрузка данных для табов «Доступный остаток» и «Точка заказа» — базовый запрос balances/get/list (полная иерархия + остатки по складам)
  React.useEffect(() => {
    setMaterialsLoading(true)
    setMaterialsError(null)
    fetch("/api/1c/warehouse/balances")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        const raw = Array.isArray(json.data) ? json.data : []
        const sorted = sortMaterialsTreeByName(raw)
        setBalancesTree(sorted)
        setDrillPath([])
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Ошибка загрузки")
        setMaterialsError(e instanceof Error ? e.message : "Ошибка загрузки")
      })
      .finally(() => {
        setLoading(false)
        setMaterialsLoading(false)
      })
  }, [])

  // Загружаем точки заказа при монтировании (нужны и в табе «Доступный остаток» для кнопки-закладки)
  React.useEffect(() => {
      fetchReorderPoints()
  }, [fetchReorderPoints])

  if (loading) {
    return <WarehouseBalanceSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
        {error}
      </div>
    )
  }

  const totalQty = balances.reduce((s, r) => s + r.Количество, 0)
  const uniqueItems = new Set(balances.map((r) => r.Код)).size
  const warehouseCount = new Set(balances.map((r) => r.Склад).filter(Boolean)).size
  const avgPerItem = uniqueItems > 0 ? Math.round(totalQty / uniqueItems) : 0
  
  // Подсчёт позиций с наступившей точкой заказа (для групповых — сумма по всем кодам; учитываем склады точки)
  const reachedReorderPoints = reorderPoints.filter((point) => {
    const ptBalances = filterBalancesByWarehouses(balances, point.warehouseCodes, warehouses)
    const codes = point.isGroup && Array.isArray(point.itemCodes)
      ? point.itemCodes
      : [point.itemCode]
    const totalQty = codes.reduce((s, c) => {
      const rows = ptBalances.filter((r) => r.Код === c)
      return s + rows.reduce((sum, r) => sum + (r.Количество ?? 0), 0)
    }, 0)
    return totalQty <= Number(point.reorderQuantity)
  }).length

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* KPI карточки — стиль как SectionCards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Всего единиц</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatMaterialQty(totalQty)}
            </CardTitle>
            <CardAction>
              <IconBox className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Суммарный остаток по всем позициям
            </div>
            <div className="text-muted-foreground">
              Единицы на складах
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Позиций номенклатуры</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatMaterialQty(uniqueItems)}
            </CardTitle>
            <CardAction>
              <IconList className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Уникальных наименований
            </div>
            <div className="text-muted-foreground">
              В учёте остатков
            </div>
          </CardFooter>
        </Card>
        <Card 
          className="@container/card cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]" 
          onClick={() => setActiveTab("reorder")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setActiveTab("reorder")}
        >
          <CardHeader>
            <CardDescription>Точки заказа</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatMaterialQty(reachedReorderPoints)}
            </CardTitle>
            <CardAction>
              <IconAlertTriangle className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {reachedReorderPoints === 1 ? "Позиция" : reachedReorderPoints > 1 && reachedReorderPoints < 5 ? "Позиции" : "Позиций"} с наступившей точкой
            </div>
            <div className="text-muted-foreground">
              Остаток равен или менее точки заказа
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Средний остаток на позицию</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatMaterialQty(avgPerItem)}
            </CardTitle>
            <CardAction>
              <IconMathAvg className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Ед. в среднем на наименование
            </div>
            <div className="text-muted-foreground">
              Всего ÷ позиций
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Табы + таблица */}
      <div className="px-4 lg:px-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === "available" || v === "reorder") {
              setActiveTab(v)
              localStorage.setItem(TAB_STORAGE_KEY, v)
            }
          }}
          className="w-full"
        >
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="available">Доступный остаток</TabsTrigger>
              <TabsTrigger value="reorder">Точка заказа</TabsTrigger>
            </TabsList>
            {activeTab === "available" && (
              <div className="relative flex-1 min-w-[200px] max-w-full">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Поиск по наименованию..."
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                  className="pl-8 pr-8"
                  aria-label="Сквозной поиск по наименованию"
                />
                {materialSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMaterialSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    aria-label="Сбросить поиск"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
              {activeTab === "reorder" && (
                <Button size="sm" className="shrink-0" onClick={() => handleOpenDialog()}>
                  <IconPlus className="h-4 w-4" />
                  Добавить позицию
                </Button>
              )}
          </div>
          <TabsContent value="available" className="mt-0">
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                {!materialsLoading && !materialsError && displayLevel.length === 0 ? (
                  <>
<div className="bg-muted/50 border-b flex items-center h-10 px-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 min-h-10 h-10 px-2 w-full">
                        <Breadcrumb className="min-w-0 flex-1 shrink">
                          <BreadcrumbList className="flex-nowrap overflow-hidden">
                            {searchResults !== null ? (
                              <>
                                <BreadcrumbItem className="shrink-0">
                                  <BreadcrumbLink asChild>
                                    <button
                                      type="button"
                                      onClick={goHome}
                                      className="inline-flex items-center gap-1 rounded p-1 -ml-1 hover:text-foreground hover:bg-muted/80 transition-colors"
                                      aria-label="Домой"
                                    >
                                      <IconHome className="h-4 w-4 shrink-0" />
                                    </button>
                                  </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="shrink-0" />
                                <BreadcrumbItem className="shrink-0 min-w-0">
                                  <BreadcrumbPage className="truncate inline-flex items-center gap-1">
                                    Результаты поиска
                                    {isSearchPending && (
                                      <IconLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                                    )}
                                  </BreadcrumbPage>
                                </BreadcrumbItem>
                              </>
                            ) : drillPath.length > 0 ? (
                              <>
                                <BreadcrumbItem className="shrink-0">
                                  <BreadcrumbLink asChild>
                                    <button
                                      type="button"
                                      onClick={() => drillTo(-1)}
                                      className="inline-flex items-center gap-1 rounded p-1 -ml-1 hover:text-foreground hover:bg-muted/80 transition-colors"
                                      aria-label="В корень"
                                    >
                                      <IconHome className="h-4 w-4 shrink-0" />
                                    </button>
                                  </BreadcrumbLink>
                                </BreadcrumbItem>
                                {drillPath.map((node, idx) => (
                                  <React.Fragment key={node.Код ?? idx}>
                                    <BreadcrumbSeparator className="shrink-0" />
                                    <BreadcrumbItem className="shrink-0 min-w-0 max-w-[180px]">
                                      {idx === drillPath.length - 1 ? (
                                        <BreadcrumbPage className="truncate block" title={node.Наименование ?? undefined}>
                                          {node.Наименование}
                                        </BreadcrumbPage>
                                      ) : (
                                        <BreadcrumbLink asChild>
                                          <button
                                            type="button"
                                            onClick={() => drillTo(idx)}
                                            className="truncate block text-left w-full hover:text-foreground"
                                            title={node.Наименование ?? undefined}
                                          >
                                            {node.Наименование}
                                          </button>
                                        </BreadcrumbLink>
                                      )}
                                    </BreadcrumbItem>
                                  </React.Fragment>
                                ))}
                              </>
                            ) : (
                              <BreadcrumbItem className="shrink-0">
                                <BreadcrumbPage className="inline-flex items-center gap-1 text-muted-foreground">
                                  <IconHome className="h-4 w-4 shrink-0" aria-hidden />
                                  <span className="sr-only">Корень</span>
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                            )}
                          </BreadcrumbList>
                        </Breadcrumb>
                        <div className="flex items-center gap-6 mr-6">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                              <Checkbox
                                checked={showHiddenGroups}
                              onCheckedChange={(v) => setShowHiddenGroups(v === true)}
                              aria-label="Отображать скрытые группы"
                            />
                            <span>Отображать скрытые группы</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                            <Checkbox
                              checked={showZeroBalances}
                              onCheckedChange={(v) => setShowZeroBalances(v === true)}
                              aria-label="Отображать нулевые остатки"
                            />
                            <span>Отображать нулевые остатки</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="w-full min-h-[280px] flex items-center justify-center">
                      <Empty className="py-12">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <IconBox className="size-6" />
                          </EmptyMedia>
                          <EmptyTitle>Нет записей, удовлетворяющих условиям отбора</EmptyTitle>
                          <EmptyDescription>
                            Попробуйте изменить настройки видимости скрытых групп или отображения нулевых остатков
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </div>
                  </>
                ) : (
                <Table className="table-fixed">
                  <colgroup>
                    <col style={{ width: 150 }} />
                    <col />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 80 }} />
                  </colgroup>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableCell colSpan={4} className="py-0 h-10 align-middle">
                        <div className="flex flex-wrap items-center justify-between gap-3 min-h-10 h-10 px-2">
                          <Breadcrumb className="min-w-0 flex-1 shrink">
                            <BreadcrumbList className="flex-nowrap overflow-hidden">
                              {searchResults !== null ? (
                                <>
                                  <BreadcrumbItem className="shrink-0">
                                    <BreadcrumbLink asChild>
                                      <button
                                        type="button"
                                        onClick={goHome}
                                        className="inline-flex items-center gap-1 rounded p-1 -ml-1 hover:text-foreground hover:bg-muted/80 transition-colors"
                                        aria-label="Домой"
                                      >
                                        <IconHome className="h-4 w-4 shrink-0" />
                                      </button>
                                    </BreadcrumbLink>
                                  </BreadcrumbItem>
                                  <BreadcrumbSeparator className="shrink-0" />
                                  <BreadcrumbItem className="shrink-0 min-w-0">
                                    <BreadcrumbPage className="truncate inline-flex items-center gap-1">
                                      Результаты поиска
                                      {isSearchPending && (
                                        <IconLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                                      )}
                                    </BreadcrumbPage>
                                  </BreadcrumbItem>
                                </>
                              ) : drillPath.length > 0 ? (
                                <>
                                  <BreadcrumbItem className="shrink-0">
                                    <BreadcrumbLink asChild>
                                      <button
                                        type="button"
                                        onClick={() => drillTo(-1)}
                                        className="inline-flex items-center gap-1 rounded p-1 -ml-1 hover:text-foreground hover:bg-muted/80 transition-colors"
                                        aria-label="В корень"
                                      >
                                        <IconHome className="h-4 w-4 shrink-0" />
                                      </button>
                                    </BreadcrumbLink>
                                  </BreadcrumbItem>
                                  {drillPath.map((node, idx) => (
                                    <React.Fragment key={node.Код ?? idx}>
                                      <BreadcrumbSeparator className="shrink-0" />
                                      <BreadcrumbItem className="shrink-0 min-w-0 max-w-[180px]">
                                        {idx === drillPath.length - 1 ? (
                                          <BreadcrumbPage className="truncate block" title={node.Наименование ?? undefined}>
                                            {node.Наименование}
                                          </BreadcrumbPage>
                                        ) : (
                                          <BreadcrumbLink asChild>
                                            <button
                                              type="button"
                                              onClick={() => drillTo(idx)}
                                              className="truncate block text-left w-full hover:text-foreground"
                                              title={node.Наименование ?? undefined}
                                            >
                                              {node.Наименование}
                                            </button>
                                          </BreadcrumbLink>
                                        )}
                                      </BreadcrumbItem>
                                    </React.Fragment>
                                  ))}
                                </>
                              ) : (
                                <BreadcrumbItem className="shrink-0">
                                  <BreadcrumbPage className="inline-flex items-center gap-1 text-muted-foreground">
                                    <IconHome className="h-4 w-4 shrink-0" aria-hidden />
                                    <span className="sr-only">Корень</span>
                                  </BreadcrumbPage>
                                </BreadcrumbItem>
                              )}
                            </BreadcrumbList>
                          </Breadcrumb>
                          <div className="flex items-center gap-6 mr-6">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                              <Checkbox
                                checked={showHiddenGroups}
                                onCheckedChange={(v) => setShowHiddenGroups(v === true)}
                                aria-label="Отображать скрытые группы"
                              />
                              <span>Отображать скрытые группы</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                              <Checkbox
                                checked={showZeroBalances}
                                onCheckedChange={(v) => setShowZeroBalances(v === true)}
                                aria-label="Отображать нулевые остатки"
                              />
                              <span>Отображать нулевые остатки</span>
                            </label>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                <TableHeader className="bg-muted">
                  <TableRow>
                      <TableHead className="w-[150px] min-w-[150px] max-w-[150px]">Код</TableHead>
                      <TableHead className="min-w-[280px]">Номенклатура</TableHead>
                      <TableHead className="w-[120px] text-right">Количество</TableHead>
                    <TableHead className="w-20">Ед. изм.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {materialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Загрузка номенклатуры...
                        </TableCell>
                      </TableRow>
                    ) : materialsError ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-destructive">
                          {materialsError}
                      </TableCell>
                    </TableRow>
                  ) : (
                      displayLevel.map((node) => {
                        const isGroup = node.ЭтоГруппа
                        const balanceRows = !isGroup ? balances.filter((b) => b.Код === node.Код) : []
                        const totalQty = balanceRows.reduce((s, r) => s + r.Количество, 0)

                        return (
                          <TableRow
                            key={isGroup ? `g-${node.Код}` : `m-${node.Код}`}
                            className={cn(isGroup && "bg-muted/30")}
                          >
                            <TableCell className="align-middle py-1 w-[150px] min-w-[150px] max-w-[150px]">
                              {!isGroup && node.Код ? (
                            <button
                              type="button"
                              onClick={() => {
                                    navigator.clipboard.writeText(node.Код)
                                    toast.success(`Код ${node.Код} скопирован`)
                              }}
                                  className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group text-sm"
                              title="Копировать код"
                            >
                              <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                                    {node.Код}
                              </span>
                                  <IconCopy className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                              ) : null}
                        </TableCell>
                            <TableCell className="align-middle py-1">
                              <div className="flex items-center gap-1.5 min-h-8">
                                {isGroup ? (
                                  <>
                                    {(() => {
                                      const code = node.Код ?? ""
                                      const pref = groupPrefs[code] ?? { favorite: false, hidden: false }
                                      const isHidden = pref.hidden
                                      const isFavorite = pref.favorite
                                      return (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (isHidden) return
                                              setGroupPref(code, { favorite: !isFavorite })
                                            }}
                                            disabled={isHidden}
                                            className={cn(
                                              "shrink-0 rounded p-1 transition-colors",
                                              isFavorite
                                                ? "text-amber-500 hover:text-amber-600"
                                                : "text-muted-foreground hover:text-foreground",
                                              isHidden && "opacity-40 cursor-not-allowed"
                                            )}
                                            title={isHidden ? "Скрытая группа не может быть в избранном" : isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                                            aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                                          >
                                            <IconStar
                                              className={cn("h-4 w-4", isFavorite && "fill-current")}
                                              aria-hidden
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setGroupPref(code, { hidden: !isHidden })
                                            }}
                                            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                                            title={isHidden ? "Показать группу" : "Скрыть группу"}
                                            aria-label={isHidden ? "Показать группу" : "Скрыть группу"}
                                          >
                                            {isHidden ? (
                                              <IconEye className="h-4 w-4" aria-hidden />
                                            ) : (
                                              <IconEyeOff className="h-4 w-4" aria-hidden />
                                            )}
                                          </button>
                                        </>
                                      )
                                    })()}
                    <Button
                                      type="button"
                                      variant="ghost"
                      size="sm"
                                      onClick={() => drillInto(node)}
                                      className="group h-8 flex-1 justify-start gap-2 font-medium hover:bg-muted/50 min-w-0"
                    >
                                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <IconFolder className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{node.Наименование}</span>
                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {(() => {
                                      const code = node.Код ?? ""
                                      const isFavorite = materialPrefs[code]?.favorite ?? false
                                      const hasReorderPoint = reorderPoints.some((rp) =>
                                        rp.itemCode === code || (rp.isGroup && Array.isArray(rp.itemCodes) && rp.itemCodes.includes(code))
                                      )
                                      return (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setMaterialPref(code, { favorite: !isFavorite })
                                            }}
                                            className={cn(
                                              "shrink-0 rounded p-1 transition-colors",
                                              isFavorite
                                                ? "text-amber-500 hover:text-amber-600"
                                                : "text-muted-foreground hover:text-foreground"
                                            )}
                                            title={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                                            aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                                          >
                                            <IconStar
                                              className={cn("h-4 w-4", isFavorite && "fill-current")}
                                              aria-hidden
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleOpenDialogForMaterial(code)
                                            }}
                                            className={cn(
                                              "shrink-0 rounded p-1 transition-colors",
                                              hasReorderPoint
                                                ? "text-blue-500 hover:text-blue-600"
                                                : "text-muted-foreground hover:text-foreground"
                                            )}
                                            title={hasReorderPoint ? "Точка заказа установлена — изменить" : "Установить точку заказа"}
                                            aria-label={hasReorderPoint ? "Изменить точку заказа" : "Установить точку заказа"}
                                          >
                                            <IconBookmark
                                              className={cn("h-4 w-4", hasReorderPoint && "fill-current")}
                                              aria-hidden
                                            />
                                          </button>
                                        </>
                                      )
                                    })()}
                                    <span className="truncate font-medium">{node.Наименование}</span>
                                  </>
                                )}
                  </div>
                            </TableCell>
                            <TableCell className="align-middle py-1 text-right tabular-nums">
                              {!isGroup ? formatMaterialQty(totalQty) : null}
                            </TableCell>
                            <TableCell className="align-middle py-1 text-muted-foreground">
                              {!isGroup ? formatUnit(node.ЕдиницаИзмерения) : null}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="reorder" className="mt-0">
            <div className="rounded-lg border overflow-hidden">
              {!reorderLoading && !reorderError && reorderPoints.length === 0 ? (
                <div className="w-full min-h-[280px] flex items-center justify-center">
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconMathAvg className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>Точки заказа ещё не добавлены</EmptyTitle>
                      <EmptyDescription>
                        Добавьте точки заказа, чтобы отслеживать достижение пороговых значений
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" onClick={() => handleOpenDialog()}>
                        <IconPlus className="h-4 w-4" />
                        Добавить позицию
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              ) : (
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-[120px]">Код</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="text-right">Точка заказа</TableHead>
                    <TableHead className="text-right">Текущий остаток</TableHead>
                    <TableHead className="text-right">Разница</TableHead>
                    <TableHead className="w-20">Ед. изм.</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reorderLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Загрузка точек заказа...
                      </TableCell>
                    </TableRow>
                  ) : reorderError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-destructive">
                        {reorderError}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reorderPoints.map((point) => {
                      const ptBalances = filterBalancesByWarehouses(balances, point.warehouseCodes, warehouses)
                      const codes = point.isGroup && Array.isArray(point.itemCodes)
                        ? point.itemCodes
                        : [point.itemCode]
                      const currentQty = codes.reduce((s, c) => {
                        const rows = ptBalances.filter((r) => r.Код === c)
                        return s + rows.reduce((sum, r) => sum + (r.Количество ?? 0), 0)
                      }, 0)
                      const diff = currentQty - Number(point.reorderQuantity)

                      return (
                        <TableRow
                          key={point.id}
                          className="h-10 cursor-pointer hover:bg-muted/50"
                          onClick={() => setDetailsPoint(point)}
                        >
                          <TableCell className="text-sm py-1">
                            {point.isGroup ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                {codes.length} поз.
                              </Badge>
                            ) : point.itemCode ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(point.itemCode)
                                toast.success(`Код ${point.itemCode} скопирован`)
                              }}
                              className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group"
                              title="Копировать код"
                            >
                              <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                                {point.itemCode}
                              </span>
                              <IconCopy className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                            </button>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{point.itemName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMaterialQty(Number(point.reorderQuantity))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMaterialQty(currentQty)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-sm font-bold tabular-nums",
                                diff > 0
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-400/30"
                                  : diff < 0
                                    ? "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-400/30"
                                    : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {diff > 0 && <IconCaretUpFilled className="h-3 w-3" aria-hidden />}
                              {diff < 0 && <IconCaretDownFilled className="h-3 w-3" aria-hidden />}
                            {diff > 0 ? "+" : ""}
                            {formatMaterialQty(diff)}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatUnit(point.unit)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(point)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                title="Редактировать"
                              >
                                <IconEdit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setItemToDelete({ id: point.id, name: point.itemName })}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Удалить"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheet добавления/редактирования точки заказа */}
      <Sheet open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <SheetContent side="right" className="flex flex-col p-0 overflow-hidden !w-[50vw] !max-w-[50vw] border-l" showCloseButton={false}>
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle>{editingPoint ? (editingPoint.itemName || "Редактировать точку заказа") : "Добавить точку заказа"}</SheetTitle>
                <SheetDescription className="mt-1">
                  Выберите материал(ы) и укажите минимальное количество. При нескольких материалах отслеживается суммарный остаток.
                </SheetDescription>
                </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="outline" size="sm" onClick={handleCloseDialog} disabled={submitting}>
                  Отмена
                </Button>
                <Button size="sm" onClick={handleAddReorderPoint} disabled={submitting}>
                  {submitting ? "Сохранение..." : editingPoint ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="flex flex-col gap-3 p-6 overflow-y-auto flex-1 min-h-0 justify-start">
            {/* Название: при редактировании — всегда показываем; при создании — только если несколько позиций */}
            {(editingPoint || selectedCodes.length > 1) && (
              <div className="space-y-1.5">
                <Label htmlFor="reorder-name" className="text-sm">Название точки заказа</Label>
                <Input
                  id="reorder-name"
                  placeholder={editingPoint ? "Введите название" : "Введите название для группы материалов"}
                  value={reorderName}
                  onChange={(e) => setReorderName(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* Выбор материала(ов) — дерево из номенклатуры */}
            <div className="space-y-1.5">
              <Label className="text-sm">Материалы</Label>
              <div className="space-y-1.5">
                <div className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Поиск по названию или коду..."
                    className="pl-8 pr-8 h-9"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                  />
                  {pickerSearch && (
                    <button
                      type="button"
                      onClick={() => setPickerSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Сбросить поиск"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="rounded-md border max-h-[22rem] overflow-y-auto">
                  {[...reorderPickerTree]
                    .sort((a, b) => {
                      if (a.ЭтоГруппа && !b.ЭтоГруппа) return -1
                      if (!a.ЭтоГруппа && b.ЭтоГруппа) return 1
                      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
                    })
                    .map((node) => (
                      <GroupTreeNode
                        key={node.Код ?? node.Наименование}
                        node={node}
                        depth={0}
                        selectedCodes={selectedCodes}
                        setSelectedCodes={setSelectedCodes}
                        searchQuery={debouncedPickerSearch}
                      />
                    ))}
                </div>
              </div>
              {selectedCodes.length > 0 && (
                <p className="text-xs text-muted-foreground">Выбрано: {selectedCodes.length}</p>
              )}
            </div>

            {/* Выбор складов для отслеживания */}
            <div className="space-y-1.5">
              <Label className="text-sm">Склады для отслеживания</Label>
              <p className="text-xs text-muted-foreground">Остаток считается только по выбранным складам</p>
              {warehouses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Загрузка складов...</p>
              ) : (
                <div className="rounded-md border max-h-[11rem] overflow-y-auto p-2 space-y-1.5">
                  {[...warehouses]
                    .sort((a, b) => {
                      const aSelected = selectedWarehouseCodes.includes(String(a.Код ?? ""))
                      const bSelected = selectedWarehouseCodes.includes(String(b.Код ?? ""))
                      if (aSelected && !bSelected) return -1
                      if (!aSelected && bSelected) return 1
                      return 0
                    })
                    .map((wh) => {
                    const code = String(wh.Код ?? "")
                    const name = wh.Наименование ?? code
                    const checked = selectedWarehouseCodes.includes(code)
                    return (
                      <label
                        key={code}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedWarehouseCodes((prev) =>
                              v ? [...prev, code] : prev.filter((c) => c !== code)
                            )
                          }}
                        />
                        <span className="truncate">{name}</span>
                        {code && (
                          <span className="text-muted-foreground font-mono text-xs">{code}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedWarehouseCodes.length > 0 && (
                <p className="text-xs text-muted-foreground">Выбрано складов: {selectedWarehouseCodes.length}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reorder-qty" className="text-sm">Точка заказа (мин. количество)</Label>
              <Input
                id="reorder-qty"
                type="text"
                inputMode="numeric"
                placeholder="100"
                value={reorderQty}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "")
                  setReorderQty(v)
                }}
                className="h-9 w-28"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet просмотра позиций точки заказа */}
      <Sheet open={detailsPoint !== null} onOpenChange={(open) => !open && setDetailsPoint(null)}>
        <SheetContent side="right" className="flex flex-col p-0 overflow-hidden !w-[50vw] !max-w-[50vw] border-l" showCloseButton={false}>
          {detailsPoint ? (() => {
            const ptBalances = filterBalancesByWarehouses(balances, detailsPoint.warehouseCodes, warehouses)
            const codes = (detailsPoint.isGroup && Array.isArray(detailsPoint.itemCodes)
              ? detailsPoint.itemCodes
              : [detailsPoint.itemCode]
            ).filter((c): c is string => Boolean(c))
            const currentQty = codes.reduce((s, c) => {
              const rows = ptBalances.filter((r) => r.Код === c)
              return s + rows.reduce((sum, r) => sum + (r.Количество ?? 0), 0)
            }, 0)
            const diff = currentQty - Number(detailsPoint.reorderQuantity)
            return (
              <SheetHeader
                className={cn(
                  "shrink-0 px-6 pt-6 pb-4 border-b",
                  diff >= 0 ? "bg-green-100 dark:bg-green-900/60" : "bg-red-100 dark:bg-red-900/60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle>{detailsPoint.itemName}</SheetTitle>
                    <SheetDescription className="sr-only">
                      Детали точки заказа: позиции, остатки и порог
                    </SheetDescription>
                  </div>
                  <Button size="sm" onClick={() => handleOpenDetailsAndEdit(detailsPoint)} className="shrink-0">
                    <IconEdit className="h-3.5 w-3.5 mr-1.5" />
                    Редактировать
                  </Button>
                </div>
              </SheetHeader>
            )
          })() : (
            <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b bg-muted/30">
              <SheetTitle>Точка заказа</SheetTitle>
              <SheetDescription className="sr-only">Просмотр позиций точки заказа</SheetDescription>
            </SheetHeader>
          )}
          <div className="space-y-4 p-6 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-md border overflow-hidden min-w-0 overflow-y-auto max-h-[26rem]">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Код</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="text-right w-[100px]">Остаток</TableHead>
                    <TableHead className="text-muted-foreground w-[60px]">Ед. изм.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsPoint
                    ? (detailsPoint.isGroup && Array.isArray(detailsPoint.itemCodes)
                        ? detailsPoint.itemCodes
                        : [detailsPoint.itemCode]
                      )
                        .filter((c): c is string => Boolean(c))
                        .map((code) => {
                          const ptBalances = filterBalancesByWarehouses(balances, detailsPoint.warehouseCodes, warehouses)
                          const bal = ptBalances.find((r) => r.Код === code)
                          const treeNode = findNodeByCode(materialsTree ?? [], code)
                          const name = bal?.Номенклатура || treeNode?.Наименование || code
                          const qty = ptBalances
                            .filter((r) => r.Код === code)
                            .reduce((sum, r) => sum + (r.Количество ?? 0), 0)
                          const unit = bal?.ЕдиницаИзмерения ?? detailsPoint?.unit
                          return (
                            <TableRow key={code}>
                              <TableCell className="font-mono text-muted-foreground text-sm py-2" style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{code}</TableCell>
                              <TableCell className="text-sm py-2">{name}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm py-2">{formatMaterialQty(qty)}</TableCell>
                              <TableCell className="text-muted-foreground text-sm py-2">{formatUnit(unit)}</TableCell>
                            </TableRow>
                          )
                        })
                    : null}
                </TableBody>
              </Table>
            </div>
            {detailsPoint && (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>Точка заказа: {formatMaterialQty(Number(detailsPoint.reorderQuantity))} {formatUnit(detailsPoint.unit)}</span>
                {(detailsPoint.isGroup && (detailsPoint.itemCodes?.length ?? 0) > 1) && (
                  <span>В группе: {(detailsPoint.itemCodes ?? []).length} позиций</span>
                )}
                {Array.isArray(detailsPoint.warehouseCodes) && detailsPoint.warehouseCodes.length > 0 && (
                  <span>
                    Склады:{" "}
                    {detailsPoint.warehouseCodes
                      .map((c) => warehouses.find((w) => String(w.Код) === c)?.Наименование ?? c)
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Alert Dialog для подтверждения удаления */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить точку заказа?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Точка заказа{" "}
              <span className="font-semibold">{itemToDelete?.name}</span>{" "}
              будет удалена из мониторинга.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReorderPoint} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function WarehouseBalanceSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="mb-4 h-9 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}
