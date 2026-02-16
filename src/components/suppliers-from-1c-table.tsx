"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { IconUsers, IconSearch, IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"

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

type SupplierRecord = Record<string, unknown>

const COLUMN_ORDER = ["Код", "Наименование", "ИНН", "КПП", "Адрес"]

function formatCell(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function getColumns(list: SupplierRecord[]): string[] {
  if (list.length === 0) return COLUMN_ORDER
  const keys = Object.keys(list[0])
  const ordered = COLUMN_ORDER.filter((k) => keys.includes(k))
  const rest = keys.filter((k) => !COLUMN_ORDER.includes(k))
  return [...ordered, ...rest]
}

const FILTERS_STORAGE_KEY = "pulse:filters:suppliers"

/**
 * Таблица поставщиков из 1С. Данные с GET /api/1c/suppliers.
 * Поиск и фильтрация как в спецификациях: сетка фильтров, localStorage, debounce, Применить/Сбросить.
 */
export function SuppliersFrom1CTable() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<SupplierRecord[]>([])
  const [filterName, setFilterName] = useState("")
  const [filterInn, setFilterInn] = useState("")
  const [page, setPage] = useState(1)

  // Восстановление фильтров из localStorage при монтировании
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(FILTERS_STORAGE_KEY) : null
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, unknown>
      if (saved && typeof saved === "object") {
        if (typeof saved.name === "string") setFilterName(saved.name)
        if (typeof saved.inn === "string") setFilterInn(saved.inn)
      }
    } catch {
      // ignore
    }
  }, [])
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ name: filterName, inn: filterInn })
      )
    } catch {
      // ignore
    }
  }, [filterName, filterInn])

  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave: setPageSizeAndSaveBase,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("suppliers-page-size")
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
    (overrides?: { name?: string; inn?: string }) => {
      const name = (overrides?.name ?? filterName).trim()
      const inn = (overrides?.inn ?? filterInn).trim()
      const params = new URLSearchParams()
      if (name) params.set("name", name)
      if (inn) params.set("inn", inn)
      const url = `/api/1c/suppliers${params.toString() ? `?${params}` : ""}`
      setLoading(true)
      setError(null)
      fetch(url)
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body) => {
              throw new Error((body?.error as string) || `Ошибка ${res.status}`)
            })
          }
          return res.json()
        })
        .then((body: { data?: unknown[] }) => {
          const data = Array.isArray(body?.data) ? body.data : []
          setList(data as SupplierRecord[])
          setPage(1)
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
    },
    [filterName, filterInn]
  )

  // Первая загрузка: восстанавливаем фильтры из localStorage и сразу грузим с ними
  useEffect(() => {
    let name = ""
    let inn = ""
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(FILTERS_STORAGE_KEY) : null
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>
        if (saved && typeof saved === "object") {
          name = typeof saved.name === "string" ? saved.name : ""
          inn = typeof saved.inn === "string" ? saved.inn : ""
        }
      }
    } catch {
      // ignore
    }
    const params = new URLSearchParams()
    if (name.trim()) params.set("name", name.trim())
    if (inn.trim()) params.set("inn", inn.trim())
    const url = `/api/1c/suppliers${params.toString() ? `?${params}` : ""}`
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error((body?.error as string) || `Ошибка ${res.status}`)
          })
        }
        return res.json()
      })
      .then((body: { data?: unknown[] }) => {
        if (cancelled) return
        const data = Array.isArray(body?.data) ? body.data : []
        setList(data as SupplierRecord[])
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounce 500ms при изменении фильтров (как в спецификациях)
  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false
      return
    }
    const t = setTimeout(() => loadList(), 500)
    return () => clearTimeout(t)
  }, [filterName, filterInn, loadList])

  const handleApplyFilters = useCallback(() => {
    loadList()
  }, [loadList])

  const handleResetFilters = useCallback(() => {
    setFilterName("")
    setFilterInn("")
    loadList({ name: "", inn: "" })
  }, [loadList])

  const columns = getColumns(list)
  const totalPages = Math.max(1, Math.ceil(list.length / effectivePageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * effectivePageSize
  const currentList = list.slice(start, start + effectivePageSize)

  // Синхронизация page при уменьшении количества страниц
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [page, totalPages])

  const filterBlock = (
    <div className="grid min-h-20 grid-cols-1 gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-1">
        <Label htmlFor="suppliers-filter-name" className="text-xs text-muted-foreground">
          По наименованию
        </Label>
        <div className="relative mt-1">
          <Input
            id="suppliers-filter-name"
            placeholder="Наименование"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
            className="h-8 pr-7"
          />
          {filterName ? (
            <ClearInputButton onClick={() => setFilterName("")} aria-label="Сбросить наименование" />
          ) : null}
        </div>
      </div>
      <div className="lg:col-span-1">
        <Label htmlFor="suppliers-filter-inn" className="text-xs text-muted-foreground">
          ИНН
        </Label>
        <div className="relative mt-1">
          <Input
            id="suppliers-filter-inn"
            placeholder="ИНН"
            value={filterInn}
            onChange={(e) => setFilterInn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
            className="h-8 pr-7"
          />
          {filterInn ? (
            <ClearInputButton onClick={() => setFilterInn("")} aria-label="Сбросить ИНН" />
          ) : null}
        </div>
      </div>
      <div className="flex items-end gap-2 lg:col-span-2">
        <Button size="sm" onClick={handleApplyFilters} className="h-8 gap-1">
          <IconSearch className="h-3.5 w-3.5" />
          Применить
        </Button>
        <Button size="sm" variant="outline" onClick={handleResetFilters} className="h-8">
          Сбросить
        </Button>
      </div>
    </div>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {filterBlock}
        <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20">
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconUsers className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Ошибка загрузки</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filterBlock}

      <div ref={tableContainerRef} className="rounded-lg border overflow-hidden">
        {loading ? (
          <TableSkeleton
            columnCount={columns.length}
            rowCount={Math.max(effectivePageSize || autoPageSize || 17, 10)}
          />
        ) : list.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center bg-muted/20">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconUsers className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Поставщики</EmptyTitle>
                <EmptyDescription>
                  Данные загружаются из 1С. Задайте критерии поиска или сбросьте фильтр.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  {columns.map((key) => (
                    <TableHead key={key} className="whitespace-nowrap">
                      {key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentList.map((row, idx) => (
                  <TableRow key={start + idx} className="hover:bg-muted/50">
                    {columns.map((key) => (
                      <TableCell key={key} className="text-sm">
                        {formatCell(row[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Пагинация и размер страницы */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Записей на странице:</span>
                <Select
                  value={pageSizeSelectValue}
                  onValueChange={(value) => {
                    if (value === "auto") {
                      setPageSizeSelectValue("auto")
                      setPage(1)
                      return
                    }
                    if (value === "custom") return
                    setPageSizeAndSave(Number(value))
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
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <IconChevronLeft className="h-4 w-4" />
                  Предыдущая
                </Button>
                <span className="text-sm text-muted-foreground">
                  Страница {safePage} из {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
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
