"use client"

import * as React from "react"
import {
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconFileText,
  IconPackage,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import { formatDate } from "@/lib/utils"
import { parseDate } from "@internationalized/date"
import { JollyDateRangePicker } from "@/components/ui/date-range-picker"

function ClearInputButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-300"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

function ClearFilterButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="rounded p-0.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-300"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

const TAB_PREFERENCE_KEY = "warehouse-movements-tab"

type DemandRow = {
  Номер?: string
  Дата?: string
  Склад?: string
  Ответственный?: string
  Комментарий?: string
  Материалы?: string
}

export function WarehouseMovementsView() {
  const { preferences, setPreference, isLoaded: prefsLoadedTab } = useUserPreferences()
  const [activeTab, setActiveTabState] = React.useState<"requirements" | "transfers" | "realizations">("requirements")
  const [loading, setLoading] = React.useState(false)
  const [demands, setDemands] = React.useState<DemandRow[]>([])
  const [demandsError, setDemandsError] = React.useState<string | null>(null)
  const [filterNumber, setFilterNumber] = React.useState("")
  const [filterComment, setFilterComment] = React.useState("")
  const [filterWarehouse, setFilterWarehouse] = React.useState("")
  const [filterDateFrom, setFilterDateFrom] = React.useState("")
  const [filterDateTo, setFilterDateTo] = React.useState("")
  const [page, setPage] = React.useState(1)

  const uniqueWarehouses = React.useMemo(
    () =>
      [...new Set(demands.map((r) => r.Склад).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b)
      ),
    [demands]
  )

  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef)
  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("warehouse-demands-page-size")
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  // Парсинг даты из 1С (ДД.ММ.ГГГГ или ДД.ММ.ГГ) или из input[type=date] (YYYY-MM-DD) в timestamp
  const parseDateToTime = React.useCallback((dateStr: string | undefined): number => {
    if (!dateStr?.trim()) return 0
    const s = dateStr.trim()
    if (s.includes("-")) {
      const [y, m, d] = s.split("-").map(Number)
      if (y != null && m != null && d != null) return new Date(y, m - 1, d).getTime()
    }
    const [datePart] = s.split(" ")
    const parts = datePart.split(".")
    if (parts.length !== 3) return new Date(s).getTime() || 0
    const [day, month, year] = parts.map(Number)
    const y = year < 100 ? 2000 + year : year
    return new Date(y, month - 1, day).getTime()
  }, [])

  const filteredDemands = React.useMemo(() => {
    let list = demands
    const numQ = filterNumber.trim().toLowerCase()
    if (numQ) {
      list = list.filter((r) => (r.Номер ?? "").toLowerCase().includes(numQ))
    }
    const commentQ = filterComment.trim().toLowerCase()
    if (commentQ) {
      list = list.filter((r) => (r.Комментарий ?? "").toLowerCase().includes(commentQ))
    }
    if (filterWarehouse) {
      list = list.filter((r) => (r.Склад ?? "") === filterWarehouse)
    }
    const fromTs = parseDateToTime(filterDateFrom || undefined)
    const toTs = parseDateToTime(filterDateTo || undefined)
    // «Дата по» — конец дня (включительно), иначе одна дата не сработает
    const toTsEndOfDay = toTs > 0 ? toTs + 24 * 60 * 60 * 1000 - 1 : 0
    if (fromTs > 0 || toTs > 0) {
      list = list.filter((r) => {
        const ts = parseDateToTime(r.Дата)
        if (fromTs > 0 && ts < fromTs) return false
        if (toTsEndOfDay > 0 && ts > toTsEndOfDay) return false
        return true
      })
    }
    return [...list].sort((a, b) => parseDateToTime(b.Дата) - parseDateToTime(a.Дата))
  }, [
    demands,
    filterNumber,
    filterComment,
    filterWarehouse,
    filterDateFrom,
    filterDateTo,
    parseDateToTime,
  ])

  const totalFilteredPages = Math.max(1, Math.ceil(filteredDemands.length / effectivePageSize))
  const startIdx = (page - 1) * effectivePageSize
  const currentDemands = filteredDemands.slice(startIdx, startIdx + effectivePageSize)

  React.useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto") {
      setPageSizeSelectValue("17")
    }
  }, [autoPageSize, pageSizeSelectValue, setPageSizeSelectValue])

  React.useEffect(() => {
    setPage(1)
  }, [filterNumber, filterComment, filterWarehouse, filterDateFrom, filterDateTo])

  const setPageSizeAndSaveDemands = React.useCallback(
    (n: number) => {
      setPageSizeAndSave(n)
      setPage(1)
    },
    [setPageSizeAndSave]
  )

  const handleResetFilters = React.useCallback(() => {
    setFilterNumber("")
    setFilterComment("")
    setFilterWarehouse("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setPage(1)
  }, [])

  const activeTabSynced = React.useRef(false)
  React.useEffect(() => {
    if (!prefsLoadedTab || activeTabSynced.current) return
    const saved = preferences[TAB_PREFERENCE_KEY]
    if (saved === "requirements" || saved === "transfers" || saved === "realizations") {
      setActiveTabState(saved)
      activeTabSynced.current = true
    }
  }, [prefsLoadedTab, preferences])

  const setActiveTab = React.useCallback(
    (v: "requirements" | "transfers" | "realizations") => {
      setActiveTabState(v)
      setPreference(TAB_PREFERENCE_KEY, v)
    },
    [setPreference]
  )

  // Загрузка требований-накладных (demands) при открытии вкладки «Требования-накладные»
  React.useEffect(() => {
    if (activeTab !== "requirements") return
    let cancelled = false
    setLoading(true)
    setDemandsError(null)
    fetch("/api/1c/warehouse/demands")
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error((b as { error?: string }).error ?? res.statusText)))
        return res.json()
      })
      .then((body: { data?: DemandRow[] }) => {
        if (cancelled) return
        setDemands(Array.isArray(body?.data) ? body.data : [])
      })
      .catch((err) => {
        if (!cancelled) setDemandsError(err instanceof Error ? err.message : "Ошибка загрузки")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab])

  return (
    <div className="px-4 lg:px-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === "requirements" || v === "transfers" || v === "realizations") setActiveTab(v)
          }}
          className="w-full"
        >
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="requirements">Требования-накладные</TabsTrigger>
              <TabsTrigger value="realizations">Реализации</TabsTrigger>
              <TabsTrigger value="transfers">Перемещения</TabsTrigger>
            </TabsList>
            <Button size="sm" className="shrink-0" disabled>
              <IconPlus className="h-4 w-4" />
              Создать документ
            </Button>
          </div>

          <TabsContent value="requirements" className="mt-0">
            {/* Блок фильтров — оформление как в заказах поставщикам / заявках на оплату */}
            <div
              className="grid min-h-[5rem] grid-cols-[auto_auto_auto_auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 mb-4"
              style={{ gridTemplateRows: "auto 32px" }}
            >
              <Label htmlFor="demands-filter-number" className="text-xs text-muted-foreground">
                Номер
              </Label>
              <Label htmlFor="demands-filter-comment" className="text-xs text-muted-foreground">
                Комментарий
              </Label>
              <Label className="text-xs text-muted-foreground">Склад</Label>
              <Label className="text-xs text-muted-foreground">
                Период
              </Label>
              <div />
              <div />

              <div className="relative w-[160px]">
                <Input
                  id="demands-filter-number"
                  placeholder="АСК000000001"
                  value={filterNumber}
                  onChange={(e) => setFilterNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                  className="h-8 pr-7"
                />
                {filterNumber ? (
                  <ClearInputButton onClick={() => setFilterNumber("")} aria-label="Очистить номер" />
                ) : null}
              </div>
              <div className="relative w-[320px] min-w-0">
                <Input
                  id="demands-filter-comment"
                  placeholder="Поиск по комментарию..."
                  value={filterComment}
                  onChange={(e) => setFilterComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                  className="h-8 pr-7"
                />
                {filterComment ? (
                  <ClearInputButton onClick={() => setFilterComment("")} aria-label="Очистить комментарий" />
                ) : null}
              </div>
              <div className="flex h-8 items-center gap-1">
                <Select
                  value={filterWarehouse || "__all__"}
                  onValueChange={(v) => setFilterWarehouse(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[220px] w-[360px] max-w-[360px]">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все</SelectItem>
                    {uniqueWarehouses.map((wh) => (
                      <SelectItem key={wh} value={wh}>
                        {wh}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterWarehouse ? (
                  <ClearFilterButton onClick={() => setFilterWarehouse("")} aria-label="Сбросить склад" />
                ) : null}
              </div>
              <div className="w-[280px] min-w-[280px]">
                <JollyDateRangePicker
                  label=""
                  fieldGroupVariant="filter"
                  className="w-full min-w-0"
                  value={
                    filterDateFrom || filterDateTo
                      ? {
                          start: filterDateFrom
                            ? parseDate(filterDateFrom)
                            : parseDate(filterDateTo!),
                          end: filterDateTo
                            ? parseDate(filterDateTo)
                            : parseDate(filterDateFrom!),
                        }
                      : null
                  }
                  onChange={(range) => {
                    if (!range) {
                      setFilterDateFrom("")
                      setFilterDateTo("")
                      return
                    }
                    const fmt = (d: { year: number; month: number; day: number }) =>
                      `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
                    setFilterDateFrom(fmt(range.start))
                    setFilterDateTo(fmt(range.end))
                  }}
                />
              </div>
              <div />
              <div className="flex h-8 items-center justify-self-end">
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilters} className="h-8">
                  Сбросить
                </Button>
              </div>
            </div>
            <div ref={tableContainerRef} className="rounded-lg border overflow-hidden">
              {loading ? (
                <TableSkeleton columnCount={6} rowCount={Math.max(effectivePageSize || autoPageSize || 17, 10)} />
              ) : demandsError ? (
                <div className="w-full min-h-[280px] flex items-center justify-center">
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconFileText className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>Ошибка загрузки</EmptyTitle>
                      <EmptyDescription>{demandsError}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : filteredDemands.length === 0 ? (
                <div className="w-full min-h-[280px] flex items-center justify-center">
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconFileText className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>
                        {demands.length === 0 ? "Требования-накладные" : "Требования-накладные не найдены"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {demands.length === 0
                          ? "Нет данных. Проверьте настройки интеграции 1С."
                          : "Измените параметры фильтров или сбросьте их."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <>
                  <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="w-[120px]">Номер</TableHead>
                        <TableHead className="w-[100px]">Дата</TableHead>
                        <TableHead>Склад</TableHead>
                        <TableHead>Ответственный</TableHead>
                        <TableHead>Комментарий</TableHead>
                        <TableHead className="w-[120px]">Материалы</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentDemands.map((row, idx) => (
                        <TableRow key={row.Номер ?? idx} className="hover:bg-muted/50">
                          <TableCell className="text-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto min-h-0 gap-1.5 px-2 py-1 font-normal"
                              onClick={() => {
                                const num = row.Номер ?? ""
                                if (num) {
                                  void navigator.clipboard.writeText(num)
                                  toast.success("Номер скопирован")
                                }
                              }}
                            >
                              <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                                {row.Номер ?? "—"}
                              </span>
                              <IconCopy className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(row.Дата)}</TableCell>
                          <TableCell className="text-sm">{row.Склад ?? "—"}</TableCell>
                          <TableCell className="text-sm">{row.Ответственный ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={row.Комментарий}>
                            {row.Комментарий ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{row.Материалы ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {/* Пагинация */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Записей на странице:</span>
                      <Select
                        value={pageSizeSelectValue}
                        onValueChange={(v) => {
                          setPageSizeSelectValue(v)
                          if (v === "auto") {
                            setPage(1)
                            return
                          }
                          const n = PAGE_SIZE_PRESETS.find((p) => String(p) === v)
                          if (n != null) setPageSizeAndSaveDemands(n)
                        }}
                      >
                        <SelectTrigger className="w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Авто</SelectItem>
                          {PAGE_SIZE_PRESETS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <IconChevronLeft className="h-4 w-4" />
                        Предыдущая
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Страница {page} из {totalFilteredPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalFilteredPages, p + 1))}
                        disabled={page >= totalFilteredPages}
                      >
                        Следующая
                        <IconChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="realizations" className="mt-0">
            <div className="rounded-lg border overflow-hidden">
              <div className="w-full min-h-[280px] flex items-center justify-center">
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconPackage className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>Реализации</EmptyTitle>
                    <EmptyDescription>
                      Функционал в разработке. Здесь будут отображаться реализации.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="mt-0">
            <div className="rounded-lg border overflow-hidden">
              <div className="w-full min-h-[280px] flex items-center justify-center">
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconArrowsExchange className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>Перемещения материалов</EmptyTitle>
                    <EmptyDescription>
                      Функционал в разработке. Здесь будут отображаться перемещения материалов между складами
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <p className="text-xs text-muted-foreground">
                      API endpoint: <code className="bg-muted px-1 py-0.5 rounded">GET /api/1c/warehouse/transfers</code>
                    </p>
                  </EmptyContent>
                </Empty>
              </div>
            </div>
          </TabsContent>
        </Tabs>
    </div>
  )
}
