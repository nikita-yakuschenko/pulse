"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Button } from "@/components/ui/button"
import { IconPlus, IconTrash } from "@tabler/icons-react"

type ReportRow = {
  id: string
  title: string | null
  status: string
  createdAt: string
  updatedAt: string
  specCount: number
  resultCount: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<ReportRow[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<ReportRow | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mrp/reports")
      const text = await res.text()
      let json: { error?: string; data?: ReportRow[] } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        // пустой или невалидный ответ
      }
      if (!res.ok) {
        toast.error(json.error || "Не удалось загрузить отчёты")
        setList([])
        return
      }
      setList(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const openDeleteDialog = (report: ReportRow) => {
    setReportToDelete(report)
    setDeleteDialogOpen(true)
  }

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setReportToDelete(null)
  }

  const confirmDelete = useCallback(async () => {
    if (!reportToDelete) return
    const id = reportToDelete.id
    try {
      const res = await fetch(`/api/mrp/reports/${id}`, { method: "DELETE" })
      const text = await res.text()
      let json: { error?: string } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        //
      }
      if (!res.ok) {
        toast.error(json.error || "Не удалось удалить")
        return
      }
      toast.success("Отчёт удалён")
      closeDeleteDialog()
      loadReports()
    } catch {
      toast.error("Ошибка удаления")
    }
  }, [reportToDelete, loadReports])

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return s
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">MRP-отчёт</h1>
          <Button asChild>
            <Link href="/purchases/analytics/new">
              <IconPlus className="h-4 w-4 mr-2" />
              Создать отчёт
            </Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Консолидированная потребность по спецификациям, складские остатки и объём к закупке.
        </p>

        <div className="rounded-md border overflow-hidden">
          {loading ? (
            <TableSkeleton columnCount={6} rowCount={10} />
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Нет сохранённых отчётов. Нажмите «Создать отчёт», чтобы сформировать первый.
            </div>
          ) : (
            <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-[200px]">Название</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Спецификаций</TableHead>
                  <TableHead>Позиций в расчёте</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/purchases/analytics/${r.id}`)}
                  >
                    <TableCell className="font-medium">
                      {r.title || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={r.status === "computed" ? "text-green-600" : "text-muted-foreground"}>
                        {r.status === "computed" ? "Рассчитан" : "Черновик"}
                      </span>
                    </TableCell>
                    <TableCell>{r.specCount}</TableCell>
                    <TableCell>{r.resultCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(r)}
                        aria-label="Удалить"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отчёт?</AlertDialogTitle>
            <AlertDialogDescription>
              {reportToDelete?.title
                ? `Отчёт «${reportToDelete.title}» будет удалён без возможности восстановления.`
                : "Этот отчёт будет удалён без возможности восстановления."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
