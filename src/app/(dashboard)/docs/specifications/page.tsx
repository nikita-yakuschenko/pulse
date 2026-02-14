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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import { IconChevronLeft, IconChevronRight, IconCopy, IconLoader, IconSearch, IconX } from "@tabler/icons-react"
import { formatDate } from "@/lib/utils"
import { parseDate as parseIsoDate } from "@internationalized/date"
import { JollyDateRangePicker } from "@/components/ui/date-range-picker"

// Ответ 1С — массив объектов, структура может отличаться
type SpecificationRecord = Record<string, unknown>


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
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<SpecificationRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<SpecificationRecord | null>(null)

  // Пагинация — настройки привязаны к пользователю (все устройства)
  const [page, setPage] = useState(1)
  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave: setPageSizeAndSaveBase,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("specifications-page-size")
  const setPageSizeAndSave = useCallback(
    (n: number) => {
      setPageSizeAndSaveBase(n)
      setPage(1)
    },
    [setPageSizeAndSaveBase]
  )

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef)
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  const loadList = useCallback(
    async (overrides?: {
      name?: string
      code?: string
      material?: string
      dateFrom?: string
      dateTo?: string
    }) => {
      setLoading(true)
      try {
        const name = overrides?.name ?? filterName
        const code = overrides?.code ?? filterCode
        const material = overrides?.material ?? filterMaterial
        const dateFrom = overrides?.dateFrom ?? filterDateFrom
        const dateTo = overrides?.dateTo ?? filterDateTo
        const year = dateFrom?.slice(0, 4) || ""
        const params = new URLSearchParams()
        if (name.trim()) params.set("name", name.trim())
        if (code.trim()) params.set("code", code.trim())
        if (material.trim()) params.set("material", material.trim())
        if (year) params.set("year", year)
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
        const nameFilter = name.trim().toLowerCase()
        let filtered =
          nameFilter.length > 0
            ? rawList.filter((row: SpecificationRecord) =>
                String(row.Наименование ?? "").toLowerCase().includes(nameFilter)
              )
            : rawList
        const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0
        const toTsEnd = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : 0
        if (fromTs > 0 || toTsEnd > 0) {
          filtered = filtered.filter((row: SpecificationRecord) => {
            const ts = parseSpecDate(row.ДатаУтверждения)
            if (fromTs > 0 && ts < fromTs) return false
            if (toTsEnd > 0 && ts > toTsEnd) return false
            return true
          })
        }
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
    [filterName, filterCode, filterMaterial, filterDateFrom, filterDateTo]
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
  }, [filterName, filterCode, filterMaterial, filterDateFrom, filterDateTo, loadList])

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
    setFilterDateFrom("")
    setFilterDateTo("")
    loadList({
      name: "",
      code: "",
      material: "",
      dateFrom: "",
      dateTo: "",
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
        <div className="lg:col-span-2 min-w-[280px]">
          <JollyDateRangePicker
            label="Год, период"
            fieldGroupVariant="filter"
            className="w-full min-w-0"
            value={
              filterDateFrom || filterDateTo
                ? {
                    start: filterDateFrom ? parseIsoDate(filterDateFrom) : parseIsoDate(filterDateTo!),
                    end: filterDateTo ? parseIsoDate(filterDateTo) : parseIsoDate(filterDateFrom!),
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
                      ) : key === "ДатаПоставки" || key === "ДатаУтверждения" ? (
                        formatDate(row[key])
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
          {/* Заголовок: наименование крупно, под ним код с копированием */}
          <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b">
            <div className="flex flex-col gap-1">
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                {detailData
                  ? String(detailData.Наименование ?? detailItem?.Наименование ?? detailItem?.Код ?? "Спецификация")
                  : detailItem
                    ? String(detailItem.Наименование ?? detailItem.Код ?? "Спецификация")
                    : "Спецификация"}
              </SheetTitle>
              {(detailData?.Код != null || detailItem?.Код != null) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    const code = String(detailData?.Код ?? detailItem?.Код ?? "")
                    if (code) {
                      navigator.clipboard.writeText(code)
                      toast.success(`Код ${code} скопирован`)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group w-fit text-sm font-mono text-muted-foreground"
                  style={codeCellStyle}
                  title="Копировать код"
                >
                  <span>{String(detailData?.Код ?? detailItem?.Код ?? "")}</span>
                  <IconCopy className="h-3.5 w-3.5 shrink-0" />
                </button>
              )}
            </div>
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
  if (key === "НоменклатурнаяГруппа") return "Группа"
  return key
}

const MATERIAL_NAME_MAX_LENGTH = 70
/** Ключи колонки «название материала» в таблице материалов (1С отдаёт «Материал») */
const MATERIAL_NAME_KEYS = ["Материал", "Наименование", "Номенклатура", "Name"]
const isMaterialNameKey = (k: string) =>
  MATERIAL_NAME_KEYS.includes(k) || /Наименование|Номенклатура/i.test(k)
const PRICE_SUM_KEYS = ["Цена", "Сумма"]

/** Для колонок Цена/Сумма: число с двумя знаками после запятой */
function formatPriceOrSum(value: unknown): string {
  if (value == null) return "—"
  const num = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toFixed(2)
}

/** Название материала в таблице материалов — не более 80 символов в видимой части */
function formatMaterialName(value: string): { display: string; full: string } {
  const full = value || "—"
  if (full.length <= MATERIAL_NAME_MAX_LENGTH) return { display: full, full }
  return { display: full.slice(0, MATERIAL_NAME_MAX_LENGTH) + "…", full }
}

const codeCellClass = "text-sm text-muted-foreground font-mono"
const codeCellStyle = { fontFamily: "var(--font-ibm-plex-mono), monospace" as const }

/** Единый стиль заголовка блока в Sheet (Общие сведения, Материалы, Плановые расходы) */
const blockTitleClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted-foreground"

/** Общие сведения — только эти три поля в одну строку */
const GENERAL_INFO_KEYS = ["Ответственный", "ДатаПоставки", "ДатаУтверждения"]

/** Плановые расходы: ключ в данных 1С → подпись в интерфейсе */
const PLANNED_EXPENSES_LABELS: Record<string, string> = {
  СтоимостьРабот: "Монтажные работы",
  СтоимостьТранспорт: "Логистика",
  СтоимостьНакладные: "Накладные расходы",
  СтоимостьАрендаСпецТехники: "Аренда спец. техники",
  СтоимостьТехнологическиеПрисоединения: "Технологическое присоединение",
  СтоимостьПроектныеРаботы: "Проектирование",
}
const PLANNED_EXPENSES_KEYS = Object.keys(PLANNED_EXPENSES_LABELS)

/** Форматирование даты для отображения (DD.MM.YYYY) */
// Используем универсальную утилиту formatDate из utils.ts

function SpecificationDetail({ data }: { data: SpecificationRecord }) {
  const materials = (data.Материалы ?? data.Materials) as unknown
  const isMaterialsArray = Array.isArray(materials)
  const materialRows = isMaterialsArray ? materials as Record<string, unknown>[] : []

  return (
    <>
      {/* Общие сведения — 3 колонки в одну строку */}
      <Card className="py-4">
        <CardContent className="pt-0 px-6 pb-0">
          <p className={blockTitleClass}>Общие сведения</p>
          <Separator className="my-3" />
          <div className="grid grid-cols-3 gap-x-8 gap-y-0">
            {GENERAL_INFO_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {formatColumnLabel(key)}
                </p>
                <p className="text-sm break-words font-normal">
                  {key === "ДатаПоставки" || key === "ДатаУтверждения"
                    ? formatDate(data[key])
                    : formatCell(data[key])}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {materialRows.length > 0 && (
        <Card className="overflow-hidden gap-1.5 py-4">
          <CardHeader className="py-0 px-6">
            <p className={blockTitleClass}>
              Материалы
              <span className="ml-2 font-normal normal-case text-foreground">
                {materialRows.length}
              </span>
            </p>
            <Separator className="my-3" />
          </CardHeader>
          <CardContent className="pt-0 px-6 pb-0">
            <div className="max-h-[26rem] overflow-y-auto rounded-lg border bg-muted/20 min-w-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    {Object.keys(materialRows[0]).map((k) => {
                      const isPriceOrSum = PRICE_SUM_KEYS.includes(k)
                      const headClass =
                        k === "Код"
                          ? "w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap text-xs"
                          : isPriceOrSum
                            ? "whitespace-nowrap text-xs text-right"
                            : "whitespace-nowrap text-xs"
                      return (
                        <TableHead key={k} className={headClass}>
                          {formatColumnLabel(k)}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRows.map((row, i) => (
                    <TableRow key={i}>
                      {Object.keys(materialRows[0]).map((k) => {
                        const raw = (row as Record<string, unknown>)[k]
                        const cellVal = formatCell(raw)
                        const isCode = k === "Код"
                        const isPriceOrSum = PRICE_SUM_KEYS.includes(k)
                        const isNameColumn = isMaterialNameKey(k)
                        const nameFormatted = isNameColumn ? formatMaterialName(cellVal) : null
                        const cellClass = isCode
                          ? "py-1.5 text-xs font-mono text-muted-foreground w-[132px] min-w-[132px] max-w-[132px]"
                          : isPriceOrSum
                            ? "py-1.5 text-xs text-right tabular-nums"
                            : "py-1.5 text-xs"
                        const displayValue = isPriceOrSum
                          ? formatPriceOrSum(raw)
                          : nameFormatted
                            ? nameFormatted.display
                            : cellVal
                        const titleAttr = nameFormatted && nameFormatted.full !== nameFormatted.display
                          ? nameFormatted.full
                          : undefined
                        return (
                          <TableCell
                            key={k}
                            className={cellClass}
                            style={isCode ? codeCellStyle : undefined}
                            title={titleAttr}
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
                              displayValue
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

      {/* Плановые расходы — 6 статей в 2 ряда по 3 колонки */}
      <Card className="py-4">
        <CardContent className="pt-0 px-6 pb-0">
          <p className={blockTitleClass}>Плановые расходы</p>
          <Separator className="my-3" />
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            {PLANNED_EXPENSES_KEYS.map((key) => {
              const value = data[key]
              const display =
                value != null && (typeof value === "number" || !Number.isNaN(Number(value)))
                  ? Number(value).toFixed(2)
                  : formatCell(value)
              return (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {PLANNED_EXPENSES_LABELS[key]}
                  </p>
                  <p className="text-sm font-normal tabular-nums">{display}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
