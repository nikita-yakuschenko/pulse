"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { IconArrowLeft, IconLoader, IconPlus, IconTrash } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatUnit } from "@/lib/utils"

type ReportResultRow = {
  id: string
  materialCode: string
  materialName: string
  unit: string | null
  nomenclatureGroup?: string | null
  demandQty: number
  balanceQty: number
  purchaseQty: number
}

type ReportSpec = {
  id: string
  specificationCode: string
  specificationName?: string | null
}

type MrpReport = {
  id: string
  title: string | null
  status: string
  createdAt: string
  updatedAt: string
  specifications: ReportSpec[]
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
  const [newSpecCode, setNewSpecCode] = useState("")
  const [addingSpec, setAddingSpec] = useState(false)
  const [deletingSpecId, setDeletingSpecId] = useState<string | null>(null)

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

  const handleAddSpecification = useCallback(async () => {
    const code = newSpecCode.trim()
    if (!code) {
      toast.error("Введите код спецификации")
      return
    }
    setAddingSpec(true)
    try {
      const res = await fetch(`/api/mrp/reports/${reportId}/specifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specificationCode: code }),
      })
      const text = await res.text()
      let json: { error?: string } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        //
      }
      if (!res.ok) {
        toast.error(json.error || "Не удалось добавить спецификацию")
        return
      }
      setNewSpecCode("")
      toast.success("Спецификация добавлена")
      loadReport()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления")
    } finally {
      setAddingSpec(false)
    }
  }, [reportId, newSpecCode, loadReport])

  const handleRemoveSpecification = useCallback(
    async (specId: string) => {
      setDeletingSpecId(specId)
      try {
        const res = await fetch(`/api/mrp/reports/${reportId}/specifications/${specId}`, {
          method: "DELETE",
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error((j as { error?: string }).error || "Не удалось удалить")
          return
        }
        toast.success("Спецификация удалена")
        loadReport()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка удаления")
      } finally {
        setDeletingSpecId(null)
      }
    },
    [reportId, loadReport]
  )

  const hasResults = !!report && Array.isArray(report.results) && report.results.length > 0
  const specList = (report?.specifications ?? []) as ReportSpec[]
  const isDraft = report?.status === "draft"

  const { groupKeys, byGroup } = useMemo(() => {
    const results = (report?.results ?? []) as ReportResultRow[]
    const byGroup = new Map<string, ReportResultRow[]>()
    for (const row of results) {
      const key = (row.nomenclatureGroup ?? "").trim() || "\u200b"
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key)!.push(row)
    }
    const groupKeys = [...byGroup.keys()].sort((a, b) => {
      if (a === "\u200b") return 1
      if (b === "\u200b") return -1
      return a.localeCompare(b, "ru")
    })
    return { groupKeys, byGroup }
  }, [report?.results])

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
      ) : (
        <>
          {/* Спецификации — только для черновика */}
          {isDraft && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <h2 className="text-sm font-medium">Спецификации</h2>
              <p className="text-xs text-muted-foreground">
                Добавьте спецификации по коду. Затем нажмите «Пересчитать», чтобы сформировать отчёт (потребность, остатки, к закупке).
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="spec-code" className="text-xs">Код спецификации</Label>
                  <Input
                    id="spec-code"
                    placeholder="00000001"
                    value={newSpecCode}
                    onChange={(e) => setNewSpecCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSpecification()}
                    className="h-8 w-[180px] font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddSpecification}
                  disabled={addingSpec || !newSpecCode.trim()}
                  className="h-8"
                >
                  {addingSpec ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" />}
                  <span className="ml-1.5">Добавить</span>
                </Button>
              </div>
              {specList.length > 0 && (
                <div className="rounded border bg-background overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Код</TableHead>
                        <TableHead>Наименование</TableHead>
                        <TableHead className="w-[80px]">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specList.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.specificationCode}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.specificationName ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveSpecification(s.id)}
                              disabled={deletingSpecId === s.id}
                              aria-label="Удалить"
                            >
                              {deletingSpecId === s.id ? (
                                <IconLoader className="h-4 w-4 animate-spin" />
                              ) : (
                                <IconTrash className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {specList.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Спецификаций пока нет. Введите код выше и нажмите «Добавить».
                </p>
              )}
            </div>
          )}

          {!hasResults ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {isDraft && specList.length === 0
                ? "Добавьте хотя бы одну спецификацию выше и нажмите «Пересчитать»."
                : isDraft && specList.length > 0
                  ? "Нажмите «Пересчитать», чтобы сформировать отчёт."
                  : "Результаты расчёта отсутствуют. Нажмите «Пересчитать», чтобы сформировать отчёт."}
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
                  {groupKeys.map((groupKey) => {
                    const groupRows = (byGroup.get(groupKey) ?? []).sort((a, b) => (a.purchaseQty === 0 ? 1 : 0) - (b.purchaseQty === 0 ? 1 : 0))
                    const groupLabel = groupKey === "\u200b" ? "Без группы" : groupKey
                    return (
                      <React.Fragment key={groupKey}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={6} className="font-medium py-2">
                            {groupLabel}
                          </TableCell>
                        </TableRow>
                        {groupRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">
                              {row.materialCode}
                            </TableCell>
                            <TableCell>
                              {row.materialName}
                            </TableCell>
                            <TableCell>
                              {formatUnit(row.unit) || "—"}
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
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

