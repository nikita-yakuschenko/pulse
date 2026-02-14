"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { IconChevronLeft, IconChevronRight, IconCopy, IconX } from "@tabler/icons-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import type { Receipt } from "@/types/1c"
import { formatDate } from "@/lib/utils"
import { parseDate as parseIsoDate } from "@internationalized/date"
import { JollyDateRangePicker } from "@/components/ui/date-range-picker"

const DEBOUNCE_MS = 500

function ClearInputButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
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

function ClearFilterButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

function parseDate(dateStr: string): Date {
  if (!dateStr?.trim()) return new Date(0)
  const s = dateStr.trim()
  if (s.includes("-") && !s.includes(".")) {
    const [y, m, d] = s.split("-").map(Number)
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) return new Date(y, m - 1, d)
  }
  const [datePart, timePart] = s.split(" ")
  const parts = (datePart || "").split(".")
  const [day = 0, month = 1, year = 0] = parts.map(Number)
  const y = year > 0 && year < 100 ? 2000 + year : year
  const [hours = 0, minutes = 0, seconds = 0] = (timePart || "0:0:0").split(":").map(Number)
  return new Date(y, (month || 1) - 1, day || 1, hours, minutes, seconds)
}

function extractShortYear(dateStr: string): string {
  const [datePart] = (dateStr || "").split(" ")
  const parts = (datePart || "").split(".")
  const year = parts[2] ?? ""
  return year.slice(-2)
}

function periodToShortYear(dateFrom: string): string {
  if (!dateFrom || !dateFrom.includes("-")) return ""
  const y = dateFrom.slice(0, 4)
  return y.length === 4 ? y.slice(-2) : ""
}

function parseDateToTime(dateStr: string | undefined): number {
  if (!dateStr?.trim()) return 0
  return parseDate(dateStr).getTime()
}

function formatSum(sum: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(sum)
}

export function ReceiptsTable() {
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [page, setPage] = useState(1)

  const [filterCode, setFilterCode] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterContractor, setFilterContractor] = useState("")
  const [filterOrg, setFilterOrg] = useState("")
  const [filterMaterial, setFilterMaterial] = useState("")
  const [filterFull, setFilterFull] = useState(false)
  const [contractorComboboxOpen, setContractorComboboxOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadDone = useRef(false)

  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave: setPageSizeAndSaveBase,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("receipts-page-size")
  const setPageSizeAndSave = useCallback(
    (n: number) => {
      setPageSizeAndSaveBase(n)
      setPage(1)
    },
    [setPageSizeAndSaveBase]
  )

  const optionsAccumulator = useRef({
    years: new Set<string>(),
    orgs: new Set<string>(),
    contractors: new Set<string>(),
  })

  const loadReceipts = useCallback(
    async (overrides?: Partial<{ code: string; dateFrom: string; dateTo: string; contractor: string; org: string; material: string; full: boolean }>) => {
      setLoading(true)
      const code = overrides?.code ?? filterCode
      const dateFrom = overrides?.dateFrom ?? filterDateFrom
      const dateTo = overrides?.dateTo ?? filterDateTo
      const contractor = overrides?.contractor ?? filterContractor
      const org = overrides?.org ?? filterOrg
      const material = overrides?.material ?? filterMaterial
      const full = overrides?.full ?? filterFull
      const year = periodToShortYear(dateFrom || dateTo)
      try {
        const params = new URLSearchParams()
        if (code.trim()) params.set("code", code.trim())
        if (year) params.set("year", year)
        if (contractor.trim()) params.set("contractor", contractor.trim())
        if (org.trim()) params.set("org", org.trim())
        if (material.trim()) params.set("material", material.trim())
        if (full) params.set("full", "1")

        const url = `/api/1c/receipts${params.toString() ? `?${params}` : ""}`
        const res = await fetch(url)
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error || "Не удалось загрузить поступления")
          setReceipts([])
          return
        }

        const list = Array.isArray(data.data) ? data.data : []
        const sorted = list.sort((a: Receipt, b: Receipt) => {
          const dateA = parseDate(a.Дата ?? "")
          const dateB = parseDate(b.Дата ?? "")
          return dateB.getTime() - dateA.getTime()
        })

        const fromTs = parseDateToTime(dateFrom || undefined)
        const toTsEnd = dateTo ? parseDateToTime(dateTo) + 24 * 60 * 60 * 1000 - 1 : 0
        const filtered =
          fromTs > 0 || toTsEnd > 0
            ? sorted.filter((r: Receipt) => {
                const ts = parseDateToTime(r.Дата)
                if (fromTs > 0 && ts < fromTs) return false
                if (toTsEnd > 0 && ts > toTsEnd) return false
                return true
              })
            : sorted

        filtered.forEach((r: Receipt) => {
          if (r.Дата) optionsAccumulator.current.years.add(extractShortYear(r.Дата))
          if (r.Организация) optionsAccumulator.current.orgs.add(r.Организация)
          if (r.Контрагент) optionsAccumulator.current.contractors.add(r.Контрагент)
        })

        setReceipts(filtered)
        setPage(1)
      } catch (error) {
        console.error("Ошибка загрузки поступлений:", error)
        toast.error("Ошибка загрузки данных")
        setReceipts([])
      } finally {
        setLoading(false)
      }
    },
    [filterCode, filterDateFrom, filterDateTo, filterContractor, filterOrg, filterMaterial, filterFull]
  )

  // Первая загрузка — без фильтров, накопить опции и показать данные
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/1c/receipts")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data.data) ? data.data : []
        const sorted = list.sort((a: Receipt, b: Receipt) => {
          const dateA = parseDate(a.Дата ?? "")
          const dateB = parseDate(b.Дата ?? "")
          return dateB.getTime() - dateA.getTime()
        })
        sorted.forEach((r: Receipt) => {
          if (r.Дата) optionsAccumulator.current.years.add(extractShortYear(r.Дата))
          if (r.Организация) optionsAccumulator.current.orgs.add(r.Организация)
          if (r.Контрагент) optionsAccumulator.current.contractors.add(r.Контрагент)
        })
        setReceipts(sorted)
        isInitialLoadDone.current = true
      })
      .catch(() => setReceipts([]))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Применение фильтров с debounce 500 мс
  useEffect(() => {
    if (!isInitialLoadDone.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      loadReceipts()
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filterCode, filterDateFrom, filterDateTo, filterContractor, filterOrg, filterMaterial, filterFull, loadReceipts])

  const handleResetFilters = useCallback(() => {
    setFilterCode("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setFilterContractor("")
    setContractorComboboxOpen(false)
    setFilterOrg("")
    setFilterMaterial("")
    setFilterFull(false)
    loadReceipts({ code: "", dateFrom: "", dateTo: "", contractor: "", org: "", material: "", full: false })
  }, [loadReceipts])

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef)
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  const uniqueOrgs = useMemo(() => Array.from(optionsAccumulator.current.orgs).sort(), [receipts])
  const uniqueContractors = useMemo(() => Array.from(optionsAccumulator.current.contractors).sort(), [receipts])

  const startIdx = (page - 1) * effectivePageSize
  const totalPages = Math.max(1, Math.ceil(receipts.length / effectivePageSize))
  const currentReceipts = receipts.slice(startIdx, startIdx + effectivePageSize)

  return (
    <div className="flex flex-col gap-3">
      {/* Фильтры — сетка как в заказах поставщикам */}
      <div
        className="grid min-h-20 grid-cols-[auto_auto_auto_auto_auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3"
        style={{ gridTemplateRows: "auto 32px" }}
      >
        <Label htmlFor="receipt-filter-code" className="text-xs text-muted-foreground">
          Номер
        </Label>
        <Label htmlFor="receipt-filter-contractor" className="text-xs text-muted-foreground">
          Контрагент
        </Label>
        <Label className="text-xs text-muted-foreground">Год, период</Label>
        <Label className="text-xs text-muted-foreground">Организация</Label>
        <Label htmlFor="receipt-filter-material" className="text-xs text-muted-foreground">
          Материал
        </Label>
        <div />
        <div />

        <div className="relative w-[160px]">
          <Input
            id="receipt-filter-code"
            placeholder="АСК00000001"
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="h-8 pr-7"
          />
          {filterCode ? (
            <ClearInputButton onClick={() => setFilterCode("")} aria-label="Сбросить номер" />
          ) : null}
        </div>
        <div className="relative w-[350px]">
          <div className="relative">
            <Input
              id="receipt-filter-contractor"
              placeholder="Контрагент..."
              value={filterContractor}
              onChange={(e) => {
                const value = e.target.value
                setFilterContractor(value)
                setContractorComboboxOpen(value.trim().length > 0)
              }}
              className="h-8 pr-7"
            />
            {filterContractor ? (
              <ClearInputButton
                onClick={() => {
                  setFilterContractor("")
                  setContractorComboboxOpen(false)
                }}
                aria-label="Сбросить контрагента"
              />
            ) : null}
          </div>
          {contractorComboboxOpen && filterContractor.trim().length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>Контрагенты не найдены</CommandEmpty>
                  <CommandGroup>
                    {uniqueContractors
                      .filter((c) => c.toLowerCase().includes(filterContractor.toLowerCase()))
                      .map((contractor) => (
                        <CommandItem
                          key={contractor}
                          value={contractor}
                          onSelect={() => {
                            setFilterContractor(contractor)
                            setContractorComboboxOpen(false)
                          }}
                        >
                          {contractor}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>
        <div className="w-[280px] min-w-[280px]">
          <JollyDateRangePicker
            label=""
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
        <div className="flex h-8 items-center gap-1">
          <Select value={filterOrg || "__all__"} onValueChange={(v) => setFilterOrg(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="h-8 w-[160px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
              {uniqueOrgs.map((org) => (
                <SelectItem key={org} value={org}>{org}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterOrg ? <ClearFilterButton onClick={() => setFilterOrg("")} aria-label="Сбросить организацию" /> : null}
        </div>
        <div className="relative min-w-0">
          <Input
            id="receipt-filter-material"
            placeholder="Код/наименование"
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="h-8 pr-7"
          />
          {filterMaterial ? (
            <ClearInputButton onClick={() => setFilterMaterial("")} aria-label="Сбросить материал" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-2">
          <Checkbox
            id="receipt-filter-full"
            checked={filterFull}
            onCheckedChange={(c) => setFilterFull(c === true)}
          />
          <span className="text-sm">Полная информация</span>
          {filterFull ? (
            <ClearFilterButton onClick={() => setFilterFull(false)} aria-label="Сбросить полную информацию" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-2 justify-self-end">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleResetFilters}>
            Сбросить
          </Button>
        </div>
      </div>

      <div ref={tableContainerRef} className="flex flex-col gap-3">
        {loading ? (
          <div className="overflow-hidden rounded-lg border">
            <TableSkeleton columnCount={5} rowCount={Math.max(effectivePageSize || autoPageSize, 10)} />
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-[100px]">Дата</TableHead>
                    <TableHead className="w-[120px]">Номер</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Организация</TableHead>
                    <TableHead className="text-right w-[120px]">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentReceipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24! text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <p className="text-sm">
                            {receipts.length === 0 ? "Поступления не найдены." : "Нет записей на этой странице."}
                          </p>
                          <p className="mt-1 text-xs">Измените параметры фильтров или сбросьте их.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentReceipts.map((row, idx) => (
                      <TableRow key={row.Номер ?? row.Дата ?? idx}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.Дата ? formatDate(row.Дата) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.Номер ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(row.Номер!)
                                toast.success(`Номер ${row.Номер} скопирован`)
                              }}
                              className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group text-sm font-mono text-muted-foreground"
                              style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                              title="Копировать номер"
                            >
                              <span>{row.Номер}</span>
                              <IconCopy className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{row.Контрагент ?? "—"}</TableCell>
                        <TableCell>{row.Организация ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {typeof row.Сумма === "number" ? formatSum(row.Сумма) : (row.Сумма != null ? String(row.Сумма) : "—")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Пагинация — как в заказах поставщикам */}
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
                <span className="text-sm text-muted-foreground">записей на странице</span>
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
                  Страница {page} из {totalPages || 1}
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
          </>
        )}
      </div>
    </div>
  )
}
