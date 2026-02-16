"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { IconStar, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"

export type FavoriteSupplier = {
  id: string
  supplier_code: string
  supplier_name: string | null
  payload: Record<string, unknown>
  created_at: string
}

/**
 * Вкладка «Избранные»: список из своей БД, работа только с ней.
 */
export function SuppliersFavoritesView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<FavoriteSupplier[]>([])

  const fetchFavorites = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/suppliers/favorites")
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error((body?.error as string) || `Ошибка ${res.status}`)
          })
        }
        return res.json()
      })
      .then((body: { data?: FavoriteSupplier[] }) => {
        setList(Array.isArray(body?.data) ? body.data : [])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const handleRemove = useCallback(
    (code: string) => {
      fetch(`/api/suppliers/favorites?code=${encodeURIComponent(code)}`, { method: "DELETE" })
        .then((res) => {
          if (!res.ok) return res.json().then((b) => Promise.reject(new Error((b?.error as string) || "Ошибка")))
        })
        .then(() => {
          toast.success("Удалено из избранного")
          fetchFavorites()
        })
        .catch((err: Error) => toast.error(err.message))
    },
    [fetchFavorites]
  )

  if (loading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <TableSkeleton columnCount={4} rowCount={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20">
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconStar className="size-6" />
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
              <IconStar className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Избранные поставщики</EmptyTitle>
            <EmptyDescription>
              Добавляйте поставщиков в избранное из вкладки «Поставщики». Здесь хранятся ваши данные в нашей БД.
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
            <TableHead className="w-[120px]">Код</TableHead>
            <TableHead>Наименование</TableHead>
            <TableHead className="w-[100px] text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/50">
              <TableCell className="text-sm font-mono">{row.supplier_code}</TableCell>
              <TableCell className="text-sm">{row.supplier_name ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(row.supplier_code)}
                  aria-label="Удалить из избранного"
                >
                  <IconTrash className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
