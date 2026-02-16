"use client"

import { useEffect, useState } from "react"
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
import { IconUsers } from "@tabler/icons-react"

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

/**
 * Таблица поставщиков из 1С. Данные с GET /api/1c/suppliers.
 */
export function SuppliersFrom1CTable() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<SupplierRecord[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/1c/suppliers")
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

  const columns = getColumns(list)

  if (loading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <TableSkeleton columnCount={columns.length} rowCount={10} />
      </div>
    )
  }

  if (error) {
    return (
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
    )
  }

  if (list.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20">
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconUsers className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Поставщики</EmptyTitle>
            <EmptyDescription>
              Данные загружаются из 1С. Справочник поставщиков будет доступен после настройки интеграции.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
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
          {list.map((row, idx) => (
            <TableRow key={idx} className="hover:bg-muted/50">
              {columns.map((key) => (
                <TableCell key={key} className="text-sm">
                  {formatCell(row[key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
