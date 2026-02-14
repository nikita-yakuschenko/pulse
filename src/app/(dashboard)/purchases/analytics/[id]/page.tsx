"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { IconArrowLeft, IconChevronDown, IconChevronRight, IconCopy, IconLoader, IconPlus, IconTrash } from "@tabler/icons-react"

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatMaterialQty, formatUnit } from "@/lib/utils"

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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<ReportResultRow | null>(null)
  const [breakdown, setBreakdown] = useState<{ specificationCode: string; specificationName: string | null; quantity: number }[] | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)

  const openMaterialSheet = useCallback((row: ReportResultRow) => {
    setSelectedMaterial(row)
    setSheetOpen(true)
    setBreakdown(null)
  }, [])

  useEffect(() => {
    if (!sheetOpen || !selectedMaterial || !reportId) return
    setBreakdownLoading(true)
    const code = encodeURIComponent(selectedMaterial.materialCode)
    fetch(`/api/mrp/reports/${reportId}/breakdown?materialCode=${code}`)
      .then((res) => res.json())
      .then((json: { error?: string; data?: { specificationCode: string; specificationName: string | null; quantity: number }[] }) => {
        if (json.error) {
          toast.error(json.error)
          setBreakdown([])
        } else {
          setBreakdown(json.data ?? [])
        }
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Ошибка загрузки")
        setBreakdown([])
      })
      .finally(() => setBreakdownLoading(false))
  }, [sheetOpen, selectedMaterial?.materialCode, reportId])

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

  // По умолчанию все номенклатурные группы свёрнуты; при смене результатов отчёта — снова свёрнуты
  useEffect(() => {
    if (groupKeys.length > 0) {
      setCollapsedGroups(new Set(groupKeys))
    }
  }, [groupKeys])

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
                    const isCollapsed = collapsedGroups.has(groupKey)
                    const toggleGroup = () => {
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(groupKey)) next.delete(groupKey)
                        else next.add(groupKey)
                        return next
                      })
                    }
                    return (
                      <React.Fragment key={groupKey}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={6} className="font-medium py-2">
                            <button
                              type="button"
                              onClick={toggleGroup}
                              className="flex items-center gap-2 text-left hover:opacity-80"
                              aria-expanded={!isCollapsed}
                            >
                              {isCollapsed ? (
                                <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <span>{groupLabel}</span>
                              <span className="text-muted-foreground font-normal">({groupRows.length})</span>
                            </button>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && groupRows.map((row) => (
                          <TableRow
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openMaterialSheet(row)}
                            onKeyDown={(e) => e.key === "Enter" && openMaterialSheet(row)}
                          >
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
                              {formatMaterialQty(row.demandQty)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMaterialQty(row.balanceQty)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatMaterialQty(row.purchaseQty)}
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

      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setSelectedMaterial(null) }}>
        <SheetContent side="right" className="flex flex-col p-0 overflow-hidden border-l">
          <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex flex-col gap-1">
              {selectedMaterial && (
                <>
                  <SheetTitle className="text-base font-semibold tracking-tight">
                    {selectedMaterial.materialName}
                  </SheetTitle>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMaterial.materialCode) {
                        navigator.clipboard.writeText(selectedMaterial.materialCode)
                        toast.success(`Код ${selectedMaterial.materialCode} скопирован`)
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded px-0 -ml-0.5 hover:bg-muted transition-colors cursor-pointer group text-sm font-mono tabular-nums text-muted-foreground hover:text-foreground w-fit"
                    title="Копировать код"
                  >
                    <span className="truncate">{selectedMaterial.materialCode}</span>
                    <IconCopy className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                  </button>
                </>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {breakdownLoading ? (
              <div className="flex items-center justify-center py-16 gap-2">
                <IconLoader className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Загрузка...</span>
              </div>
            ) : breakdown && breakdown.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Код</TableHead>
                      <TableHead>Наименование</TableHead>
                      <TableHead className="w-[100px] text-right">Количество</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdown.map((item) => (
                      <TableRow key={item.specificationCode}>
                        <TableCell className="font-mono text-xs">{item.specificationCode}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.specificationName ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMaterialQty(item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedMaterial && (() => {
                  const sum = breakdown.reduce((s, i) => s + i.quantity, 0)
                  return (
                    <div className="mt-4 pt-4 border-t flex items-baseline justify-end gap-2 text-sm">
                      <span className="text-muted-foreground">Итого:</span>
                      <span className="font-semibold tabular-nums">{formatMaterialQty(sum)}</span>
                      {selectedMaterial.unit && (
                        <span className="text-muted-foreground">{formatUnit(selectedMaterial.unit)}</span>
                      )}
                    </div>
                  )
                })()}
              </>
            ) : breakdown && breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Нет данных по спецификациям.</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

