"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { IconLoader } from "@tabler/icons-react"

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  const minYear = 2023
  return Array.from({ length: current - minYear + 1 }, (_, i) => current - i)
})()

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все месяцы" },
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

type SpecRow = Record<string, unknown>

function getSpecCode(row: SpecRow): string {
  const v = row.Код ?? row.Code
  return v != null ? String(v).trim() : ""
}

function getSpecName(row: SpecRow): string {
  const v = row.Наименование ?? row.Name
  return v != null ? String(v).trim() : ""
}

export default function NewMrpReportPage() {
  const router = useRouter()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState("")
  const [specList, setSpecList] = useState<SpecRow[]>([])
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())

  const loadSpecifications = useCallback(async () => {
    setLoadingSpecs(true)
    setSpecList([])
    setSelectedCodes(new Set())
    try {
      const params = new URLSearchParams()
      params.set("year", String(year))
      if (month) params.set("month", month)
      const res = await fetch(`/api/1c/specifications?${params}`)
      const text = await res.text()
      let json: { error?: string; data?: unknown } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        //
      }
      if (!res.ok) {
        toast.error(json.error || "Не удалось загрузить спецификации")
        return
      }
      const data = json.data
      const list = Array.isArray(data) ? data as SpecRow[] : []
      setSpecList(list)
      if (list.length === 0) {
        toast.info("По выбранному периоду спецификаций не найдено")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoadingSpecs(false)
    }
  }, [year, month])

  useEffect(() => {
    loadSpecifications()
  }, [loadSpecifications])

  const allCodes = specList.map(getSpecCode).filter(Boolean)
  const allSelected = allCodes.length > 0 && allCodes.every((c) => selectedCodes.has(c))
  const someSelected = allCodes.some((c) => selectedCodes.has(c))

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedCodes(new Set())
    } else {
      setSelectedCodes(new Set(allCodes))
    }
  }, [allSelected, allCodes])

  const toggleOne = useCallback((code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const handleCreateReport = useCallback(async () => {
    const codes = Array.from(selectedCodes).filter(Boolean)
    if (codes.length === 0) {
      toast.error("Выберите хотя бы одну спецификацию")
      return
    }
    setCreating(true)
    try {
      const specifications = specList
        .filter((row) => selectedCodes.has(getSpecCode(row)))
        .map((row) => ({
          specificationCode: getSpecCode(row),
          specificationName: getSpecName(row) || null,
        }))
      const res = await fetch("/api/mrp/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month: month ? parseInt(month, 10) : undefined,
          specifications,
        }),
      })
      const text = await res.text()
      let json: { error?: string; data?: { id?: string } } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        //
      }
      if (!res.ok) {
        toast.error(json.error || "Не удалось создать отчёт")
        return
      }
      const id = json.data?.id
      if (id) {
        toast.success("Отчёт создан")
        router.replace(`/purchases/analytics/${id}`)
      } else {
        toast.error("Нет id в ответе")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания")
    } finally {
      setCreating(false)
    }
  }, [year, month, selectedCodes, router])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Создать MRP-отчёт</h1>
        <p className="text-sm text-muted-foreground">
          Выберите период, загрузите спецификации и отметьте нужные. Затем нажмите «Создать отчёт» — откроется черновик, нажмите «Пересчитать» для формирования результатов.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Год</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Месяц</Label>
          <Select value={month || "all"} onValueChange={(v) => setMonth(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Все месяцы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все месяцы</SelectItem>
              {MONTH_OPTIONS.filter((m) => m.value).map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={loadSpecifications}
          disabled={loadingSpecs}
          className="h-8"
        >
          {loadingSpecs ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
          <span className={loadingSpecs ? "ml-2" : ""}>Обновить список</span>
        </Button>
      </div>

      {loadingSpecs ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <IconLoader className="h-5 w-5 animate-spin" />
          Загрузка спецификаций…
        </div>
      ) : specList.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Нет данных за выбранный период. Измените год/месяц и нажмите «Обновить список» или дождитесь загрузки из 1С.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Отмечено: {selectedCodes.size} из {specList.length}
            </p>
            <Button
              type="button"
              onClick={handleCreateReport}
              disabled={creating || selectedCodes.size === 0}
            >
              {creating && <IconLoader className="h-4 w-4 animate-spin mr-2" />}
              Создать отчёт
            </Button>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px]">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Выбрать все"
                    />
                  </TableHead>
                  <TableHead className="w-[140px]">Код</TableHead>
                  <TableHead>Наименование</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specList.map((row, idx) => {
                  const code = getSpecCode(row)
                  if (!code) return null
                  return (
                    <TableRow
                      key={`${code}-${idx}`}
                      className="cursor-pointer"
                      onClick={() => toggleOne(code)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedCodes.has(code)}
                          onCheckedChange={() => toggleOne(code)}
                          aria-label={`Выбрать ${code}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{code}</TableCell>
                      <TableCell className="text-sm">{getSpecName(row) || "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/purchases/analytics">К списку отчётов</Link>
        </Button>
      </div>
    </div>
  )
}
