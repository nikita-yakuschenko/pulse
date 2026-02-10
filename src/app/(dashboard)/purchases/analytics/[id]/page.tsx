"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { IconArrowLeft, IconLoader } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ReportResultRow = {
  id: string
  materialCode: string
  materialName: string
  unit: string | null
  demandQty: number
  balanceQty: number
  purchaseQty: number
}

type MrpReport = {
  id: string
  title: string | null
  status: string
  createdAt: string
  updatedAt: string
  specifications: unknown[]
  results: ReportResultRow[]
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function MrpReportDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const reportId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : ""

  if (!reportId) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="py-16 text-center text-sm text-destructive">
          Не указан идентификатор отчёта.
        </div>
      </div>
    )
  }

  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [report, setReport] = useState<MrpReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mrp/reports/${reportId}`)
      const text = await res.text()
      let json: { error?: string; data?: MrpReport } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        // ignore invalid JSON
      }
      if (!res.ok) {
        const msg = json.error || "Не удалось загрузить отчёт"
        setError(msg)
        toast.error(msg)
        setReport(null)
        return
      }
      if (json.data) {
        setReport(json.data)
      } else {
        setError("Пустой ответ от сервера")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true)
    try {
      const res = await fetch(`/api/mrp/reports/${reportId}/calculate`, {
        method: "POST",
      })
      const text = await res.text()
      let json: { error?: string; data?: MrpReport } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        // ignore invalid JSON
      }
      if (!res.ok) {
        const msg = json.error || "Не удалось пересчитать отчёт"
        toast.error(msg)
        return
      }
      if (json.data) {
        setReport(json.data)
        toast.success("Отчёт пересчитан")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось пересчитать отчёт"
      toast.error(msg)
    } finally {
      setRecalculating(false)
    }
  }, [reportId])

  const hasResults = !!report && Array.isArray(report.results) && report.results.length > 0

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/purchases/analytics")} aria-label="К списку отчётов">
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold">
              {report?.title || "MRP-отчёт"}
            </h1>
            {report && (
              <p className="text-sm text-muted-foreground">
                Статус:{" "}
                <span className={report.status === "computed" ? "text-green-600" : "text-muted-foreground"}>
                  {report.status === "computed" ? "Рассчитан" : "Черновик"}
                </span>{" "}
                · Создан: {formatDateTime(report.createdAt)} · Обновлён:{" "}
                {formatDateTime(report.updatedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/purchases/analytics">
              К списку
            </Link>
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            {recalculating && (
              <IconLoader className="h-4 w-4 mr-2 animate-spin" />
            )}
            Пересчитать
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Загрузка отчёта…</span>
        </div>
      ) : error ? (
        <div className="py-16 text-center text-sm text-destructive">
          {error}
        </div>
      ) : !report ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Отчёт не найден.
        </div>
      ) : !hasResults ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Результаты расчёта отсутствуют. Нажмите «Пересчитать», чтобы сформировать отчёт.
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Код</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead className="w-[80px]">Ед.</TableHead>
                <TableHead className="w-[120px] text-right">Потребность</TableHead>
                <TableHead className="w-[120px] text-right">Остаток</TableHead>
                <TableHead className="w-[120px] text-right">К закупке</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.results.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">
                    {row.materialCode}
                  </TableCell>
                  <TableCell>
                    {row.materialName}
                  </TableCell>
                  <TableCell>
                    {row.unit ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.demandQty.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.balanceQty.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.purchaseQty.toLocaleString("ru-RU")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

