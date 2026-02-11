"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { IconChevronLeft, IconChevronRight, IconCopy, IconLoader, IconSearch, IconX } from "@tabler/icons-react"

// Ответ 1С — массив объектов, структура может отличаться
type SpecificationRecord = Record<string, unknown>

const YEAR_PLACEHOLDER = "__all__"
const MONTH_PLACEHOLDER = "__all__"

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  const minYear = 2023
  return Array.from({ length: current - minYear + 1 }, (_, i) => current - i)
})()

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Январь" },
  { value: "2", label: "Февраль" },
  { value: "3", label: "Март" },
  { value: "4", label: "Апрель" },
  { value: "5", label: "Май" },
  { value: "6", label: "Июнь" },
  { value: "7", label: "Июль" },
  { value: "8", label: "Август" },
  { value: "9", label: "Сентябрь" },
  { value: "10", label: "Октябрь" },
  { value: "11", label: "Ноябрь" },
  { value: "12", label: "Декабрь" },
]

function ClearInputButton({
  onClick,
  "aria-label": ariaLabel = "Сбросить",
}: {
  onClick: () => void
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

export default function SpecificationsPage() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<SpecificationRecord[]>([])
  const [filterName, setFilterName] = useState("")
  const [filterCode, setFilterCode] = useState("")
  const [filterMaterial, setFilterMaterial] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<SpecificationRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<SpecificationRecord | null>(null)

  // Пагинация — как в Заказах/Заявках
  const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("specifications-page-size")
      const n = saved ? Number(saved) : 17
      return n >= 1 && n <= 500 ? n : 17
    }
    return 17
  })
  const [pageSizeSelectValue, setPageSizeSelectValue] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("specifications-page-size")
      const n = saved ? Number(saved) : 17
      return PAGE_SIZE_PRESETS.includes(n) ? String(n) : "custom"
    }
    return "17"
  })
  const setPageSizeAndSave = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(500, n))
    setPageSize(clamped)
    setPage(1)
    setPageSizeSelectValue(PAGE_SIZE_PRESETS.includes(clamped) ? String(clamped) : "custom")
    localStorage.setItem("specifications-page-size", String(clamped))
  }, [])

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef)
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  const loadList = useCallback(
    async (overrides?: {
      name?: string
      code?: string
      material?: string
      year?: string
      month?: string
    }) => {
      setLoading(true)
      try {
        const name = overrides?.name ?? filterName
        const code = overrides?.code ?? filterCode
        const material = overrides?.material ?? filterMaterial
        const year = overrides?.year ?? filterYear
        const month = overrides?.month ?? filterMonth
        const params = new URLSearchParams()
        if (name.trim()) params.set("name", name.trim())
        if (code.trim()) params.set("code", code.trim())
        if (material.trim()) params.set("material", material.trim())
        if (year.trim()) params.set("year", year.trim())
        if (month.trim()) params.set("month", month.trim())
        const url = `/api/1c/specifications${params.toString() ? `?${params}` : ""}`
        const res = await fetch(url)
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error || "Не удалось загрузить спецификации")
          setList([])
          return
        }
        const data = json.data
        const rawList = Array.isArray(data) ? data : []
        // Клиентская фильтрация по наименованию: 1С может вернуть лишние строки — оставляем только с вхождением подстроки
        const nameFilter = name.trim().toLowerCase()
        const filtered =
          nameFilter.length > 0
            ? rawList.filter((row: SpecificationRecord) =>
                String(row.Наименование ?? "").toLowerCase().includes(nameFilter)
              )
            : rawList
        // Сортировка для отображения: всегда по дате утверждения, от новых к старым
        const sorted = [...filtered].sort((a, b) => {
          const dateA = parseSpecDate(a.ДатаУтверждения)
          const dateB = parseSpecDate(b.ДатаУтверждения)
          return dateB - dateA
        })
        setList(sorted)
        setPage(1)
      } catch {
        toast.error("Ошибка загрузки данных")
        setList([])
      } finally {
        setLoading(false)
      }
    },
    [filterName, filterCode, filterMaterial, filterYear, filterMonth]
  )

  useEffect(() => {
    loadList()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce 500ms при изменении фильтров (поиск/фильтрация)
  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false
      return
    }
    const t = setTimeout(() => loadList(), 500)
    return () => clearTimeout(t)
  }, [filterName, filterCode, filterMaterial, filterYear, filterMonth, loadList])

  const handleApplyFilters = useCallback(() => {
    loadList()
  }, [loadList])

  const handleOpenDetail = useCallback(
    async (item: SpecificationRecord) => {
      setDetailItem(item)
      setDetailOpen(true)
      setDetailData(null)
      const code = item.Код != null ? String(item.Код) : ""
      const name = item.Наименование != null ? String(item.Наименование) : ""
      if (!code && !name) {
        setDetailData(item)
        return
      }
      setDetailLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("full", "1")
        if (code) params.set("code", code)
        else if (name) params.set("name", name)
        const res = await fetch(`/api/1c/specifications?${params}`)
        const json = await res.json()
        if (res.ok && Array.isArray(json.data) && json.data.length > 0) {
          setDetailData(json.data[0] as SpecificationRecord)
        } else {
          setDetailData(item)
        }
      } catch {
        setDetailData(item)
      } finally {
        setDetailLoading(false)
      }
    },
    []
  )

  const handleResetFilters = useCallback(() => {
    setFilterName("")
    setFilterCode("")
    setFilterMaterial("")
    setFilterYear("")
    setFilterMonth("")
    loadList({
      name: "",
      code: "",
      material: "",
      year: "",
      month: "",
    })
  }, [loadList])

  // Поля «Стоимость*» показываем только в Sheet (детали), в общей таблице не выводим
  const isSheetOnlyField = (key: string) => key.startsWith("Стоимость")
  const SPEC_COLUMN_ORDER = ["Код", "Наименование", "ДатаПоставки", "Ответственный", "ДатаУтверждения"]
  const columns =
    list.length > 0
      ? (() => {
          const keys = Object.keys(list[0]).filter(
            (k) => k !== "Материалы" && k !== "Materials" && !isSheetOnlyField(k)
          )
          const ordered = SPEC_COLUMN_ORDER.filter((k) => keys.includes(k))
          const rest = keys.filter((k) => !SPEC_COLUMN_ORDER.includes(k))
          return [...ordered, ...rest]
        })()
      : SPEC_COLUMN_ORDER

  const totalPages = Math.max(1, Math.ceil(list.length / effectivePageSize))
  const startIdx = (page - 1) * effectivePageSize
  const endIdx = startIdx + effectivePageSize
  const currentPageList = list.slice(startIdx, endIdx)

  useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto") {
      setPageSizeSelectValue("17")
    }
  }, [autoPageSize, pageSizeSelectValue])

  // Сброс страницы, если после фильтрации текущая страница вне диапазона
  useEffect(() => {
    if (list.length > 0 && page > totalPages) setPage(1)
  }, [list.length, page, totalPages])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Спецификации</h1>
        <div className="mt-3 flex flex-col gap-3">
        <div className="grid min-h-[5rem] grid-cols-1 gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-1">
          <Label htmlFor="spec-name" className="text-xs text-muted-foreground" title="Строка передаётся в 1С: поиск по вхождению в наименовании (логика на стороне 1С)">
            По наименованию
          </Label>
          <div className="relative mt-1">
            <Input
              id="spec-name"
              placeholder="Наименование"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="h-8 pr-7"
            />
            {filterName ? (
              <ClearInputButton
                onClick={() => setFilterName("")}
                aria-label="Сбросить имя"
              />
            ) : null}
          </div>
        </div>
        <div className="lg:col-span-1">
          <Label htmlFor="spec-code" className="text-xs text-muted-foreground">
            По коду
          </Label>
          <div className="relative mt-1">
            <Input
              id="spec-code"
              placeholder="00000001"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="h-8 pr-7"
            />
            {filterCode ? (
              <ClearInputButton
                onClick={() => setFilterCode("")}
                aria-label="Сбросить код"
              />
            ) : null}
          </div>
        </div>
        <div className="lg:col-span-1">
          <Label htmlFor="spec-material" className="text-xs text-muted-foreground">
            По материалу
          </Label>
          <div className="relative mt-1">
            <Input
              id="spec-material"
              placeholder="Код или наименование"
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="h-8 pr-7"
            />
            {filterMaterial ? (
              <ClearInputButton
                onClick={() => setFilterMaterial("")}
                aria-label="Сбросить материал"
              />
            ) : null}
          </div>
        </div>
        <div className="lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Год</Label>
          <Select
            value={filterYear || YEAR_PLACEHOLDER}
            onValueChange={(v) => setFilterYear(v === YEAR_PLACEHOLDER ? "" : v)}
          >
            <SelectTrigger size="sm" className="mt-1 h-8 w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YEAR_PLACEHOLDER}>Все</SelectItem>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Месяц</Label>
          <Select
            value={filterMonth || MONTH_PLACEHOLDER}
            onValueChange={(v) => setFilterMonth(v === MONTH_PLACEHOLDER ? "" : v)}
          >
            <SelectTrigger size="sm" className="mt-1 h-8 w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MONTH_PLACEHOLDER}>Все</SelectItem>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 lg:col-span-1">
          <Button size="sm" onClick={handleApplyFilters} className="h-8 gap-1">
            <IconSearch className="h-3.5 w-3.5" />
            Применить
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetFilters} className="h-8">
            Сбросить
          </Button>
        </div>
      </div>

      <div ref={tableContainerRef} className="flex flex-col gap-3">
      <div className="rounded-md border overflow-hidden">
        {loading ? (
          <TableSkeleton columnCount={6} rowCount={10} />
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Нет данных. Измените фильтры или дождитесь загрузки из 1С.
          </div>
        ) : (
          <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
            <TableHeader className="bg-muted">
              <TableRow>
                {columns.map((key) => (
                  <TableHead
                    key={key}
                    className={key === "Код" ? "w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap" : "whitespace-nowrap"}
                  >
                    {formatColumnLabel(key)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageList.map((row, idx) => (
                <TableRow
                  key={startIdx + idx}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDetail(row)}
                >
                  {columns.map((key) => (
                    <TableCell
                      key={key}
                      className={key === "Код" ? `${codeCellClass} w-[132px] min-w-[132px] max-w-[132px]` : "text-sm"}
                      style={key === "Код" ? codeCellStyle : undefined}
                    >
                      {key === "Код" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const code = formatCell(row[key])
                            if (code && code !== "—") {
                              navigator.clipboard.writeText(code)
                              toast.success(`Код ${code} скопирован`)
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group"
                          title="Копировать код"
                        >
                          <span style={codeCellStyle}>{formatCell(row[key])}</span>
                          <IconCopy className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                      ) : (
                        formatCell(row[key])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </div>

        {/* Пагинация — как в Заказах/Заявках */}
        {!loading && list.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-[120px]">
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
                  <SelectItem value="17">17</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="custom">Своё...</SelectItem>
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
              <span className="text-sm text-muted-foreground">
                записей на странице
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <IconChevronLeft className="h-4 w-4" />
                Предыдущая
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                Следующая
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 overflow-hidden !w-[50vw] !max-w-[50vw] border-l"
          showCloseButton={false}
        >
          {/* Шапка как у заказа: подпись + крупный код/наименование с копированием */}
          <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex items-baseline justify-between gap-4">
              <SheetTitle className="text-base font-semibold tracking-tight text-muted-foreground">
                Спецификация
              </SheetTitle>
              {detailItem && (detailItem.Код != null || detailItem.Наименование != null) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    const val = String(detailItem.Код ?? detailItem.Наименование ?? "")
                    if (val) {
                      navigator.clipboard.writeText(val)
                      toast.success(
                        detailItem.Код != null ? `Код ${val} скопирован` : `Скопировано: ${val}`
                      )
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-1 -mr-1 hover:bg-muted transition-colors cursor-pointer group text-xl font-semibold tabular-nums tracking-tight max-w-[70%] truncate"
                  style={
                    detailItem?.Код != null
                      ? { fontFamily: "var(--font-ibm-plex-mono), monospace" }
                      : undefined
                  }
                  title={detailItem?.Код != null ? "Копировать код" : "Копировать"}
                >
                  <span className="truncate">
                    {String(detailItem.Код ?? detailItem.Наименование ?? "")}
                  </span>
                  <IconCopy className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              )}
            </div>
            {detailItem?.Наименование != null && detailItem?.Код != null && (
              <SheetDescription className="text-sm mt-1">
                {String(detailItem.Наименование)}
              </SheetDescription>
            )}
          </SheetHeader>

          {detailLoading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Загрузка...</span>
            </div>
          ) : detailData ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-6">
                <SpecificationDetail data={detailData} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Парсит дату из ответа 1С (строка или число), возвращает timestamp для сортировки. */
function parseSpecDate(value: unknown): number {
  if (value == null) return 0
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const s = String(value).trim()
  if (!s) return 0
  const iso = s.includes("T") ? s : s.replace(/(\d{1,2})\.(\d{1,2})\.(\d{4})/, "$3-$2-$1")
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatCell(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** Отображаемое название колонки/поля: пробелы в «Дата утверждения», «Дата поставки» и т.п. */
function formatColumnLabel(key: string): string {
  if (key === "ДатаУтверждения") return "Дата утверждения"
  if (key === "ДатаПоставки") return "Дата поставки"
  return key
}

const codeCellClass = "text-sm text-muted-foreground font-mono"
const codeCellStyle = { fontFamily: "var(--font-ibm-plex-mono), monospace" as const }

function SpecificationDetail({ data }: { data: SpecificationRecord }) {
  const materials = (data.Материалы ?? data.Materials) as unknown
  const isMaterialsArray = Array.isArray(materials)
  const materialRows = isMaterialsArray ? materials as Record<string, unknown>[] : []
  const restKeys = Object.keys(data).filter(
    (k) => k !== "Материалы" && k !== "Materials"
  )

  return (
    <>
      {/* Карточка основных данных — сетка полей как у заказа */}
      <Card className="py-4">
        <CardContent className="pt-0 px-6 pb-0">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {restKeys.map((key) => {
              const value = formatCell(data[key])
              const isCode = key === "Код"
              return (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {formatColumnLabel(key)}
                  </p>
                  <p
                    className="text-sm break-words font-normal"
                    style={isCode ? codeCellStyle : undefined}
                  >
                    {isCode && value !== "—" ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(value)
                          toast.success(`Код ${value} скопирован`)
                        }}
                        className="inline-flex items-center gap-1 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group font-mono text-muted-foreground"
                        title="Копировать код"
                      >
                        <span>{value}</span>
                        <IconCopy className="h-3 w-3 text-muted-foreground shrink-0" />
                      </button>
                    ) : (
                      value
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {materialRows.length > 0 && (
        <Card className="overflow-hidden gap-1.5 py-4">
          <CardHeader className="py-0 pb-1.5 px-6">
            <CardTitle className="text-xs font-medium tracking-tight text-muted-foreground uppercase">
              Материалы
              <span className="ml-2 font-normal normal-case text-foreground">
                {materialRows.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-6 pb-0">
            <div className="max-h-[26rem] overflow-y-auto rounded-lg border bg-muted/20 min-w-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    {Object.keys(materialRows[0]).map((k) => (
                      <TableHead
                        key={k}
                        className={k === "Код" ? "w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap text-xs" : "whitespace-nowrap text-xs"}
                      >
                        {formatColumnLabel(k)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRows.map((row, i) => (
                    <TableRow key={i}>
                      {Object.keys(materialRows[0]).map((k) => {
                        const cellVal = formatCell((row as Record<string, unknown>)[k])
                        const isCode = k === "Код"
                        return (
                          <TableCell
                            key={k}
                            className={isCode ? "py-1.5 text-xs font-mono text-muted-foreground w-[132px] min-w-[132px] max-w-[132px]" : "py-1.5 text-xs"}
                            style={isCode ? codeCellStyle : undefined}
                          >
                            {isCode && cellVal !== "—" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(cellVal)
                                  toast.success(`Код ${cellVal} скопирован`)
                                }}
                                className="inline-flex items-center gap-1 rounded px-0.5 -ml-0.5 hover:bg-muted transition-colors cursor-pointer group"
                                title="Копировать код"
                              >
                                <span style={codeCellStyle}>{cellVal}</span>
                                <IconCopy className="h-3 w-3 text-muted-foreground shrink-0" />
                              </button>
                            ) : (
                              cellVal
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
