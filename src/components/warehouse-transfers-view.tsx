"use client"

import * as React from "react"
import {
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconFileText,
  IconLoader,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useUserPreferences } from "@/contexts/user-preferences-context"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import { formatDate, formatUnit } from "@/lib/utils"
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

const TAB_PREFERENCE_KEY = "warehouse-transfers-tab"
const TAB_LOCAL_KEY = "pulse-pref:warehouse-transfers-tab"
const FILTERS_STORAGE_KEY = "pulse:filters:warehouse-requirements"

function getInitialTab(): "requirements" | "transfers" | "realizations" {
  if (typeof window === "undefined") return "requirements"
  try {
    const v = localStorage.getItem(TAB_LOCAL_KEY)
    if (v === "requirements" || v === "transfers" || v === "realizations") return v
  } catch {
    // ignore
  }
  return "requirements"
}

// Один раз читаем сохранённые фильтры для инициализации state (избегаем гонки с эффектом сохранения)
let cachedInitialWarehouseFilters: {
  number: string
  comment: string
  warehouse: string
  dateFrom: string
  dateTo: string
} | null = null
function getInitialWarehouseFilters(): {
  number: string
  comment: string
  warehouse: string
  dateFrom: string
  dateTo: string
} {
  if (cachedInitialWarehouseFilters) return cachedInitialWarehouseFilters
  if (typeof window === "undefined")
    return { number: "", comment: "", warehouse: "", dateFrom: "", dateTo: "" }
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) {
      cachedInitialWarehouseFilters = { number: "", comment: "", warehouse: "", dateFrom: "", dateTo: "" }
      return cachedInitialWarehouseFilters
    }
    const saved = JSON.parse(raw) as Record<string, unknown>
    if (!saved || typeof saved !== "object") {
      cachedInitialWarehouseFilters = { number: "", comment: "", warehouse: "", dateFrom: "", dateTo: "" }
      return cachedInitialWarehouseFilters
    }
    cachedInitialWarehouseFilters = {
      number: typeof saved.number === "string" ? saved.number : "",
      comment: typeof saved.comment === "string" ? saved.comment : "",
      warehouse: typeof saved.warehouse === "string" ? saved.warehouse : "",
      dateFrom: typeof saved.dateFrom === "string" ? saved.dateFrom : "",
      dateTo: typeof saved.dateTo === "string" ? saved.dateTo : "",
    }
    return cachedInitialWarehouseFilters
  } catch {
    cachedInitialWarehouseFilters = { number: "", comment: "", warehouse: "", dateFrom: "", dateTo: "" }
    return cachedInitialWarehouseFilters
  }
}

type DemandRow = {
  Номер?: string
  Дата?: string
  Склад?: string
  Ответственный?: string
  Комментарий?: string
  Материалы?: string
}

type TransferRow = {
  Номер?: string
  Дата?: string
  СкладОтправитель?: string
  СкладПолучатель?: string
  Ответственный?: string
  Комментарий?: string
  Материалы?: string
}

type TransferGoodsRow = {
  НомерСтроки?: string
  Номенклатура?: string
  ХарактеристикаНоменклатуры?: string
  ЕдиницаИзмерения?: string
  Количество?: number
}

type TransferFull = TransferRow & {
  Товары?: TransferGoodsRow[]
}

export function WarehouseTransfersView() {
  const { preferences, setPreference, isLoaded: prefsLoadedTab } = useUserPreferences()
  const [activeTab, setActiveTabState] = React.useState<"requirements" | "transfers" | "realizations">(getInitialTab)
  const [loading, setLoading] = React.useState(false)
  const [demands, setDemands] = React.useState<DemandRow[]>([])
  const [demandsError, setDemandsError] = React.useState<string | null>(null)
  const [filterNumber, setFilterNumber] = React.useState(() => getInitialWarehouseFilters().number)
  const [filterComment, setFilterComment] = React.useState(() => getInitialWarehouseFilters().comment)
  const [filterWarehouse, setFilterWarehouse] = React.useState(() => getInitialWarehouseFilters().warehouse)
  const [filterDateFrom, setFilterDateFrom] = React.useState(() => getInitialWarehouseFilters().dateFrom)
  const [filterDateTo, setFilterDateTo] = React.useState(() => getInitialWarehouseFilters().dateTo)
  const [page, setPage] = React.useState(1)

  const [transfers, setTransfers] = React.useState<TransferRow[]>([])
  const [transfersError, setTransfersError] = React.useState<string | null>(null)
  const [transfersLoading, setTransfersLoading] = React.useState(false)
  const [transferFilterNumber, setTransferFilterNumber] = React.useState("")
  const [selectedTransferFull, setSelectedTransferFull] = React.useState<TransferFull | null>(null)
  const [transferSheetOpen, setTransferSheetOpen] = React.useState(false)
  const [transferDetailLoading, setTransferDetailLoading] = React.useState(false)
  const [transfersPage, setTransfersPage] = React.useState(1)

  // Сброс кэша при размонтировании, чтобы при повторном входе читать актуальный localStorage
  React.useEffect(() => () => { cachedInitialWarehouseFilters = null }, [])

  // Сохранение фильтров в localStorage при изменении
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          number: filterNumber,
          comment: filterComment,
          warehouse: filterWarehouse,
          dateFrom: filterDateFrom,
          dateTo: filterDateTo,
        })
      )
    } catch {
      // ignore
    }
  }, [filterNumber, filterComment, filterWarehouse, filterDateFrom, filterDateTo])

  const uniqueWarehouses = React.useMemo(
    () =>
      [...new Set(demands.map((r) => r.Склад).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b)
      ),
    [demands]
  )

  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef, {
    enabled: activeTab === "requirements",
  })
  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("warehouse-demands-page-size")
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  const transfersTableContainerRef = React.useRef<HTMLDivElement>(null)
  const transfersAutoPageSize = useTableAutoPageSize(transfersTableContainerRef, {
    enabled: activeTab === "transfers",
  })
  const {
    pageSize: transferPageSize,
    pageSizeSelectValue: transferPageSizeSelectValue,
    setPageSizeAndSave: setTransferPageSizeAndSave,
    setPageSizeSelectValue: setTransferPageSizeSelectValue,
    PAGE_SIZE_PRESETS: TRANSFER_PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("warehouse-transfers-page-size")
  const useTransferAutoSize = transferPageSizeSelectValue === "auto" && transfersAutoPageSize > 0
  const effectiveTransferPageSize = useTransferAutoSize ? transfersAutoPageSize : transferPageSize

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

  const filteredTransfers = React.useMemo(() => {
    let list = transfers
    const numQ = transferFilterNumber.trim().toLowerCase()
    if (numQ) list = list.filter((r) => (r.Номер ?? "").toLowerCase().includes(numQ))
    return [...list].sort((a, b) => parseDateToTime(b.Дата) - parseDateToTime(a.Дата))
  }, [transfers, transferFilterNumber, parseDateToTime])
  const totalTransferPages = Math.max(1, Math.ceil(filteredTransfers.length / effectiveTransferPageSize))
  const startTransferIdx = (transfersPage - 1) * effectiveTransferPageSize
  const currentTransfers = filteredTransfers.slice(startTransferIdx, startTransferIdx + effectiveTransferPageSize)

  // Сбрасываем «Авто» в 17 только на узком экране (мобильные), где авто-высота не считается. На десктопе не трогаем — иначе при загрузке (пока autoPageSize ещё 0) затирали бы сохранённое «Авто» в БД.
  const DESKTOP_MIN_PX = 1024
  React.useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto" && typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN_PX) {
      setPageSizeAndSave(17)
      setPage(1)
    }
  }, [autoPageSize, pageSizeSelectValue, setPageSizeAndSave])

  React.useEffect(() => {
    if (transfersAutoPageSize === 0 && transferPageSizeSelectValue === "auto" && typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN_PX) {
      setTransferPageSizeAndSave(17)
      setTransfersPage(1)
    }
  }, [transfersAutoPageSize, transferPageSizeSelectValue, setTransferPageSizeAndSave])

  React.useEffect(() => {
    setPage(1)
  }, [filterNumber, filterComment, filterWarehouse, filterDateFrom, filterDateTo])

  React.useEffect(() => {
    setTransfersPage(1)
  }, [transferFilterNumber])

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
      try {
        if (typeof window !== "undefined") localStorage.setItem(TAB_LOCAL_KEY, v)
      } catch {
        // ignore
      }
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

  // Загрузка перемещений при открытии вкладки «Перемещения»
  React.useEffect(() => {
    if (activeTab !== "transfers") return
    let cancelled = false
    setTransfersLoading(true)
    setTransfersError(null)
    fetch("/api/1c/warehouse/transfers")
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error((b as { error?: string }).error ?? res.statusText)))
        return res.json()
      })
      .then((body: { data?: TransferRow[] }) => {
        if (cancelled) return
        setTransfers(Array.isArray(body?.data) ? body.data : [])
      })
      .catch((err) => {
        if (!cancelled) setTransfersError(err instanceof Error ? err.message : "Ошибка загрузки")
      })
      .finally(() => {
        if (!cancelled) setTransfersLoading(false)
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
                        onValueChange={(value) => {
                          if (value === "custom") {
                            setPageSizeSelectValue("custom")
                            return
                          }
                          if (value === "auto") {
                            setPageSizeSelectValue("auto")
                            setPage(1)
                            return
                          }
                          setPageSizeAndSave(Number(value))
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="w-[120px]">
                          {pageSizeSelectValue === "auto" && autoPageSize > 0 ? (
                            <span>Авто ({autoPageSize})</span>
                          ) : (
                            <SelectValue placeholder="Выберите..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {autoPageSize > 0 && (
                            <SelectItem value="auto">Авто ({autoPageSize})</SelectItem>
                          )}
                          {(PAGE_SIZE_PRESETS as number[]).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                          {pageSizeSelectValue === "custom" && !(PAGE_SIZE_PRESETS as number[]).includes(pageSize) && (
                            <SelectItem value="custom">Своё ({pageSize})</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {pageSizeSelectValue === "custom" && (
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={pageSize}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 17 : Number(e.target.value)
                            if (!Number.isNaN(v)) setPageSizeAndSave(v)
                          }}
                          className="h-8 w-[72px]"
                        />
                      )}
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
            <div className="grid min-h-[5rem] grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 mb-4" style={{ gridTemplateRows: "auto 32px" }}>
              <Label htmlFor="transfers-filter-number" className="text-xs text-muted-foreground">
                Номер
              </Label>
              <div />
              <div />
              <div className="relative w-[160px]">
                <Input
                  id="transfers-filter-number"
                  placeholder="АСК00000556"
                  value={transferFilterNumber}
                  onChange={(e) => setTransferFilterNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setTransfersPage(1)}
                  className="h-8 pr-7"
                />
                {transferFilterNumber ? (
                  <ClearInputButton onClick={() => setTransferFilterNumber("")} aria-label="Очистить номер" />
                ) : null}
              </div>
              <div />
              <div className="flex h-8 justify-self-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setTransferFilterNumber(""); setTransfersPage(1) }}
                  className="h-8"
                >
                  Сбросить
                </Button>
              </div>
            </div>
            <div ref={transfersTableContainerRef} className="rounded-lg border overflow-hidden">
              {transfersLoading ? (
                <TableSkeleton columnCount={7} rowCount={Math.max(effectiveTransferPageSize || transfersAutoPageSize || 17, 10)} />
              ) : transfersError ? (
                <div className="w-full min-h-[280px] flex items-center justify-center">
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconArrowsExchange className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>Ошибка загрузки</EmptyTitle>
                      <EmptyDescription>{transfersError}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : filteredTransfers.length === 0 ? (
                <div className="w-full min-h-[280px] flex items-center justify-center">
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconArrowsExchange className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>
                        {transfers.length === 0 ? "Перемещения" : "Перемещения не найдены"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {transfers.length === 0
                          ? "Нет данных. Проверьте настройки интеграции 1С."
                          : "Измените параметры фильтра или сбросьте его."}
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
                        <TableHead>Склад отправитель</TableHead>
                        <TableHead>Склад получатель</TableHead>
                        <TableHead>Ответственный</TableHead>
                        <TableHead>Комментарий</TableHead>
                        <TableHead className="w-[120px]">Материалы</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTransfers.map((row, idx) => (
                        <TableRow
                          key={`${row.Номер ?? ""}-${row.Дата ?? ""}-${idx}`}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            const num = row.Номер ?? ""
                            if (!num) return
                            setTransferDetailLoading(true)
                            setTransferSheetOpen(true)
                            setSelectedTransferFull(null)
                            const params = new URLSearchParams()
                            // 1С в пути ожидает короткий код (165), а не полный номер (АСК00000165)
                            const digits = (num || "").replace(/\D/g, "")
                            const codeForApi = digits ? String(Number(digits)) : num
                            params.set("code", codeForApi)
                            const datePart = (row.Дата ?? "").trim().split(" ")[0] ?? ""
                            const [, , yearPart] = datePart.split(".")
                            const year = yearPart ? String(yearPart).slice(-2) : ""
                            if (year) params.set("year", year)
                            params.set("full", "1")
                            fetch(`/api/1c/warehouse/transfers?${params}`)
                              .then((res) =>
                                res.json().then((body: { data?: TransferFull[]; error?: string }) => ({ ok: res.ok, body }))
                              )
                              .then(({ ok, body }) => {
                                if (!ok || !Array.isArray(body?.data)) {
                                  setSelectedTransferFull(null)
                                  return
                                }
                                setSelectedTransferFull(body.data[0] ?? null)
                              })
                              .catch(() => setSelectedTransferFull(null))
                              .finally(() => setTransferDetailLoading(false))
                          }}
                        >
                          <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
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
                          <TableCell className="text-sm">{row.СкладОтправитель ?? "—"}</TableCell>
                          <TableCell className="text-sm">{row.СкладПолучатель ?? "—"}</TableCell>
                          <TableCell className="text-sm">{row.Ответственный ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={row.Комментарий}>
                            {row.Комментарий ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{row.Материалы ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Записей на странице:</span>
                      <Select
                        value={transferPageSizeSelectValue}
                        onValueChange={(value) => {
                          if (value === "custom") {
                            setTransferPageSizeSelectValue("custom")
                            return
                          }
                          if (value === "auto") {
                            setTransferPageSizeSelectValue("auto")
                            setTransfersPage(1)
                            return
                          }
                          setTransferPageSizeAndSave(Number(value))
                          setTransfersPage(1)
                        }}
                      >
                        <SelectTrigger className="w-[120px]">
                          {transferPageSizeSelectValue === "auto" && transfersAutoPageSize > 0 ? (
                            <span>Авто ({transfersAutoPageSize})</span>
                          ) : (
                            <SelectValue placeholder="Выберите..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {transfersAutoPageSize > 0 && (
                            <SelectItem value="auto">Авто ({transfersAutoPageSize})</SelectItem>
                          )}
                          {(TRANSFER_PAGE_SIZE_PRESETS as number[]).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                          {transferPageSizeSelectValue === "custom" && !(TRANSFER_PAGE_SIZE_PRESETS as number[]).includes(transferPageSize) && (
                            <SelectItem value="custom">Своё ({transferPageSize})</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {transferPageSizeSelectValue === "custom" && (
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={transferPageSize}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 17 : Number(e.target.value)
                            if (!Number.isNaN(v)) setTransferPageSizeAndSave(v)
                          }}
                          className="h-8 w-[72px]"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransfersPage((p) => Math.max(1, p - 1))}
                        disabled={transfersPage <= 1}
                      >
                        <IconChevronLeft className="h-4 w-4" />
                        Предыдущая
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Страница {transfersPage} из {totalTransferPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransfersPage((p) => Math.min(totalTransferPages, p + 1))}
                        disabled={transfersPage >= totalTransferPages}
                      >
                        Следующая
                        <IconChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Sheet open={transferSheetOpen} onOpenChange={setTransferSheetOpen}>
              <SheetContent side="right" className="flex flex-col p-0 overflow-hidden" showCloseButton={false}>
                {/* Заголовок: как в спецификациях — крупно наименование, под ним номер с копированием */}
                <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b">
                  <div className="flex flex-col gap-1">
                    <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                      {transferDetailLoading
                        ? "Загрузка..."
                        : selectedTransferFull
                          ? "Перемещение"
                          : "Перемещение"}
                    </SheetTitle>
                    {selectedTransferFull?.Номер && !transferDetailLoading && (
                      <button
                        type="button"
                        onClick={() => {
                          const num = selectedTransferFull.Номер ?? ""
                          if (num) {
                            void navigator.clipboard.writeText(num)
                            toast.success("Номер скопирован")
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group w-fit text-sm font-mono text-muted-foreground"
                        style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        title="Копировать номер"
                      >
                        <span>{selectedTransferFull.Номер}</span>
                        <IconCopy className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </SheetHeader>

                {transferDetailLoading ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <IconLoader className="h-8 w-8 animate-spin" aria-hidden />
                    <span className="text-sm">Загрузка...</span>
                  </div>
                ) : selectedTransferFull ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6 space-y-6">
                      {/* Общие сведения — как блок в спецификациях */}
                      <Card className="py-4">
                        <CardContent className="pt-0 px-6 pb-0">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Общие сведения
                          </p>
                          <Separator className="my-3" />
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Дата</p>
                              <p className="text-sm font-normal">{formatDate(selectedTransferFull.Дата)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Склад отправитель</p>
                              <p className="text-sm font-normal">{selectedTransferFull.СкладОтправитель ?? "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Склад получатель</p>
                              <p className="text-sm font-normal">{selectedTransferFull.СкладПолучатель ?? "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ответственный</p>
                              <p className="text-sm font-normal">{selectedTransferFull.Ответственный ?? "—"}</p>
                            </div>
                            {selectedTransferFull.Комментарий ? (
                              <div className="space-y-1 col-span-2">
                                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Комментарий</p>
                                <p className="text-sm font-normal">{selectedTransferFull.Комментарий}</p>
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Товары — таблица в Card как «Материалы» в спецификациях */}
                      {selectedTransferFull.Товары && selectedTransferFull.Товары.length > 0 ? (
                        <Card className="overflow-hidden gap-1.5 py-4">
                          <CardContent className="pt-0 px-6 pb-0">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Товары
                              <span className="ml-2 font-normal normal-case text-foreground">
                                {selectedTransferFull.Товары.length}
                              </span>
                            </p>
                            <Separator className="my-3" />
                            <div className="max-h-[26rem] overflow-y-auto rounded-lg border bg-muted/20 min-w-0">
                              <Table>
                                <TableHeader className="bg-muted/50">
                                  <TableRow>
                                    <TableHead className="w-[60px] text-xs">№</TableHead>
                                    <TableHead className="text-xs">Номенклатура</TableHead>
                                    <TableHead className="text-xs">Характеристика</TableHead>
                                    <TableHead className="w-[80px] text-xs">Ед.</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs">Кол-во</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedTransferFull.Товары.map((line, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-sm py-1.5">{line.НомерСтроки ?? "—"}</TableCell>
                                      <TableCell className="text-sm py-1.5">{line.Номенклатура ?? "—"}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground py-1.5">{line.ХарактеристикаНоменклатуры ?? "—"}</TableCell>
                                      <TableCell className="text-sm py-1.5">{formatUnit(line.ЕдиницаИзмерения) || "—"}</TableCell>
                                      <TableCell className="text-sm text-right py-1.5">{line.Количество ?? "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <p className="text-sm text-muted-foreground">Нет позиций в перемещении.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Не удалось загрузить детали.</p>
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>
        </Tabs>
    </div>
  )
}
