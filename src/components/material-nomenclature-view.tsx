"use client"

import * as React from "react"
import {
  IconAdjustments,
  IconBox,
  IconChevronRight,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconHome,
  IconLoader,
  IconList,
  IconPlus,
  IconSearch,
  IconStar,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { MaterialTreeNode } from "@/types/1c"
import { cn } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Собрать из дерева только материалы (не группы), у которых наименование или код совпадает с запросом. Сквозной поиск.
 *  excludedGroupCodes — коды групп верхнего уровня, которые исключены из поиска (их поддеревья пропускаются).
 */
function collectMatchingMaterials(
  nodes: MaterialTreeNode[] | null | undefined,
  query: string,
  excludedGroupCodes?: Set<string>,
): MaterialTreeNode[] {
  if (!nodes?.length || !query.trim()) return []
  const q = query.trim().toLowerCase()
  const result: MaterialTreeNode[] = []
  for (const node of nodes) {
    if (node.ЭтоГруппа) {
      if (excludedGroupCodes?.has(node.Код ?? "")) continue
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

/** Количество листьев (материалов) в дереве */
function countMaterialLeaves(nodes: MaterialTreeNode[] | null | undefined): number {
  if (!nodes?.length) return 0
  let n = 0
  for (const node of nodes) {
    if (node.ЭтоГруппа && node.Дети?.length) {
      n += countMaterialLeaves(node.Дети)
    } else if (!node.ЭтоГруппа) {
      n += 1
    }
  }
  return n
}

export function MaterialNomenclatureView() {
  const [materialsTree, setMaterialsTree] = React.useState<MaterialTreeNode[] | null>(null)
  const [materialsLoading, setMaterialsLoading] = React.useState(false)
  const [materialsError, setMaterialsError] = React.useState<string | null>(null)
  const [drillPath, setDrillPath] = React.useState<MaterialTreeNode[]>([])
  const [materialSearchQuery, setMaterialSearchQuery] = React.useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("")
  const [groupPrefs, setGroupPrefs] = React.useState<Record<string, { favorite: boolean; hidden: boolean }>>({})
  const [materialPrefs, setMaterialPrefs] = React.useState<Record<string, { favorite: boolean }>>({})
  /** Отображать скрытые группы (по умолчанию — нет) */
  const [showHiddenGroups, setShowHiddenGroups] = React.useState(false)
  /** Коды групп верхнего уровня, исключённых из поиска (из API, привязка к пользователю) */
  const [excludedGroups, setExcludedGroups] = React.useState<Set<string>>(new Set())

  /** Сохранить исключения поиска через API (PUT — полная замена) */
  const saveExcludedGroups = React.useCallback(async (codes: Set<string>) => {
    try {
      await fetch("/api/warehouse/search-exclusions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "nomenclature", groupCodes: [...codes] }),
      })
    } catch {
      // при ошибке сохранения — тихо, данные уже обновлены в state
    }
  }, [])

  const toggleExcludedGroup = React.useCallback((code: string) => {
    setExcludedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      saveExcludedGroups(next)
      return next
    })
  }, [saveExcludedGroups])

  /** Группы верхнего уровня дерева (для настроек поиска) */
  const topLevelGroups = React.useMemo(
    () => (materialsTree ?? []).filter((n) => n.ЭтоГруппа).sort((a, b) => (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")),
    [materialsTree]
  )

  // Дебаунс 500 мс
  React.useEffect(() => {
    if (materialSearchQuery === "") {
      setDebouncedSearchQuery("")
      return
    }
    const t = window.setTimeout(() => setDebouncedSearchQuery(materialSearchQuery), 500)
    return () => window.clearTimeout(t)
  }, [materialSearchQuery])

  const isSearchPending = materialSearchQuery !== debouncedSearchQuery

  // Текущий уровень дерева
  const currentLevel = React.useMemo(() => {
    const list =
      drillPath.length === 0
        ? (materialsTree ?? [])
        : (drillPath[drillPath.length - 1].Дети ?? [])
    return [...list].sort((a, b) => {
      const aGroup = a.ЭтоГруппа ? 1 : 0
      const bGroup = b.ЭтоГруппа ? 1 : 0
      if (aGroup !== bGroup) return bGroup - aGroup
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [materialsTree, drillPath])

  // Сквозной поиск с ранжированием: для цифровых запросов — сначала совпадения по названию, потом по коду
  const searchResults = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return null
    const q = debouncedSearchQuery.trim().toLowerCase()
    const isNumeric = /^\d+$/.test(q)
    const flat = collectMatchingMaterials(materialsTree ?? [], debouncedSearchQuery, excludedGroups.size > 0 ? excludedGroups : undefined)
    return [...flat].sort((a, b) => {
      // Избранные всегда вверху
      const aFav = materialPrefs[a.Код ?? ""]?.favorite ? 1 : 0
      const bFav = materialPrefs[b.Код ?? ""]?.favorite ? 1 : 0
      if (aFav !== bFav) return bFav - aFav
      // Для цифровых запросов: совпадение по названию важнее, чем по коду
      if (isNumeric) {
        const aInName = (a.Наименование ?? "").toLowerCase().includes(q) ? 1 : 0
        const bInName = (b.Наименование ?? "").toLowerCase().includes(q) ? 1 : 0
        if (aInName !== bInName) return bInName - aInName
      }
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [materialsTree, debouncedSearchQuery, materialPrefs, excludedGroups])

  // Фильтр по скрытым группам (в обычном режиме; при поиске не используется)
  const levelAfterHidden = React.useMemo(() => {
    if (showHiddenGroups) return currentLevel
    return currentLevel.filter((node) => {
      if (!node.ЭтоГруппа) return true
      const pref = groupPrefs[node.Код ?? ""]
      return !pref?.hidden
    })
  }, [currentLevel, showHiddenGroups, groupPrefs])

  // Итоговый список: все записи, без фильтрации нулевых остатков
  const displayLevel = React.useMemo(() => {
    if (searchResults !== null) return searchResults
    return [...levelAfterHidden].sort((a, b) => {
      const aGroup = a.ЭтоГруппа ? 1 : 0
      const bGroup = b.ЭтоГруппа ? 1 : 0
      if (aGroup !== bGroup) return bGroup - aGroup
      const aFav = a.ЭтоГруппа
        ? (groupPrefs[a.Код ?? ""]?.favorite ? 1 : 0)
        : (materialPrefs[a.Код ?? ""]?.favorite ? 1 : 0)
      const bFav = b.ЭтоГруппа
        ? (groupPrefs[b.Код ?? ""]?.favorite ? 1 : 0)
        : (materialPrefs[b.Код ?? ""]?.favorite ? 1 : 0)
      if (aFav !== bFav) return bFav - aFav
      return (a.Наименование ?? "").localeCompare(b.Наименование ?? "", "ru")
    })
  }, [searchResults, levelAfterHidden, groupPrefs, materialPrefs])

  const drillInto = React.useCallback((node: MaterialTreeNode) => {
    setDrillPath((prev) => [...prev, node])
  }, [])

  const goHome = React.useCallback(() => {
    setMaterialSearchQuery("")
    setDrillPath([])
  }, [])

  const drillTo = React.useCallback((index: number) => {
    if (index < 0) setDrillPath([])
    else setDrillPath((prev) => prev.slice(0, index + 1))
  }, [])

  // ---- Prefs ----
  /** Загрузить все настройки одним запросом (group prefs + material prefs + search exclusions) */
  const fetchAllPrefs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/warehouse/all-prefs?section=nomenclature")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки")
      setGroupPrefs(json.groupPrefs ?? {})
      setMaterialPrefs(json.materialPrefs ?? {})
      setExcludedGroups(new Set(json.searchExclusions ?? []))
    } catch {
      setGroupPrefs({})
      setMaterialPrefs({})
      setExcludedGroups(new Set())
    }
  }, [])

  const setGroupPref = React.useCallback(
    async (groupCode: string, patch: { favorite?: boolean; hidden?: boolean }) => {
      try {
        const res = await fetch("/api/warehouse/material-group-prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupCode, section: "nomenclature", ...patch }),
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
          body: JSON.stringify({ materialCode, section: "nomenclature", favorite: patch.favorite }),
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

  // ---- Загрузка ----
  React.useEffect(() => {
    fetchAllPrefs()
  }, [fetchAllPrefs])

  React.useEffect(() => {
    setMaterialsLoading(true)
    setMaterialsError(null)
    fetch("/api/1c/materials")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        const raw = Array.isArray(json.data) ? json.data : []
        const sorted = sortMaterialsTreeByName(raw)
        setMaterialsTree(sorted)
        setDrillPath([])
      })
      .catch((e) => {
        setMaterialsError(e instanceof Error ? e.message : "Ошибка загрузки номенклатуры")
      })
      .finally(() => setMaterialsLoading(false))
  }, [])

  const totalMaterials = countMaterialLeaves(materialsTree)

  // ---- Breadcrumbs helper (JSX) ----
  const breadcrumbsContent = (
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
  )

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* KPI */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Позиций в справочнике</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {materialsLoading ? "—" : totalMaterials.toLocaleString("ru-RU")}
            </CardTitle>
            <CardAction>
              <IconList className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">Всего наименований</div>
            <div className="text-muted-foreground">Номенклатура из 1С</div>
          </CardFooter>
        </Card>
      </div>

      {/* Поиск + таблица */}
      <div className="px-4 lg:px-6">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="shrink-0 h-9 gap-1.5 relative">
                <IconAdjustments className="h-4 w-4" />
                Настройки поиска
                {excludedGroups.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {excludedGroups.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-3 py-2.5">
                <p className="text-sm font-medium">Исключить из поиска</p>
                <p className="text-xs text-muted-foreground mt-0.5">Отмеченные группы не будут участвовать в поиске</p>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {topLevelGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-2">Группы загружаются...</p>
                ) : (
                  topLevelGroups.map((group) => {
                    const code = group.Код ?? ""
                    const excluded = excludedGroups.has(code)
                    return (
                      <label
                        key={code}
                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-sm hover:bg-muted/50 transition-colors select-none"
                      >
                        <Checkbox
                          checked={excluded}
                          onCheckedChange={() => toggleExcludedGroup(code)}
                          aria-label={`Исключить «${group.Наименование}» из поиска`}
                        />
                        <IconFolder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{group.Наименование}</span>
                      </label>
                    )
                  })
                )}
              </div>
              {excludedGroups.size > 0 && (
                <div className="border-t px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      const empty = new Set<string>()
                      setExcludedGroups(empty)
                      saveExcludedGroups(empty)
                    }}
                  >
                    Сбросить все исключения
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button size="default" className="shrink-0 h-9" disabled>
            <IconPlus className="h-4 w-4" />
            Добавить
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border overflow-hidden">
            {!materialsLoading && !materialsError && displayLevel.length === 0 ? (
              <>
                <div className="bg-muted/50 border-b flex items-center h-10 px-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 min-h-10 h-10 px-2 w-full">
                    {breadcrumbsContent}
                    <div className="flex items-center gap-6 mr-6">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                        <Checkbox
                          checked={showHiddenGroups}
                          onCheckedChange={(v) => setShowHiddenGroups(v === true)}
                          aria-label="Отображать скрытые группы"
                        />
                        <span>Отображать скрытые группы</span>
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
                      <EmptyTitle>Нет записей</EmptyTitle>
                      <EmptyDescription>
                        Измените поиск или перейдите в другую группу
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
                </colgroup>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableCell colSpan={2} className="py-0 h-10 align-middle">
                      <div className="flex flex-wrap items-center justify-between gap-3 min-h-10 h-10 px-2">
                        {breadcrumbsContent}
                        <div className="flex items-center gap-6 mr-6">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                            <Checkbox
                              checked={showHiddenGroups}
                              onCheckedChange={(v) => setShowHiddenGroups(v === true)}
                              aria-label="Отображать скрытые группы"
                            />
                            <span>Отображать скрытые группы</span>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        Загрузка номенклатуры...
                      </TableCell>
                    </TableRow>
                  ) : materialsError ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-destructive">
                        {materialsError}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayLevel.map((node) => {
                      const isGroup = node.ЭтоГруппа
                      const code = node.Код ?? ""

                      return (
                        <TableRow
                          key={isGroup ? `g-${code}` : `m-${code}`}
                          className={cn(isGroup && "bg-muted/30")}
                        >
                          {/* Код — и у групп, и у материалов */}
                          <TableCell className="align-middle py-1 w-[150px] min-w-[150px] max-w-[150px]">
                            {code ? (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(code)
                                  toast.success(`Код ${code} скопирован`)
                                }}
                                className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group text-sm"
                                title="Копировать код"
                              >
                                <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                                  {code}
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
                                    const isFavorite = materialPrefs[code]?.favorite ?? false
                                    return (
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
                                    )
                                  })()}
                                  <span className="truncate font-medium">{node.Наименование}</span>
                                </>
                              )}
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
        </div>
      </div>
    </div>
  )
}
