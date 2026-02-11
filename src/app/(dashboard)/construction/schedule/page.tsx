"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IconBox, IconChevronLeft, IconChevronRight, IconLayoutGrid } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TERRITORIES, MOCK_SCHEDULE_OBJECTS } from "@/lib/mock-construction-schedule"
import type { ConstructionObject } from "@/types/construction-schedule"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS = [
  { value: "2026-03", label: "Март 2026" },
  { value: "2026-04", label: "Апрель 2026" },
]
const TERRITORY_ALL = "all"
const TYPE_ALL = "all"
const MANAGER_ALL = "all"

// Формат суммы: 6 179 000
function formatAmount(amount: number): string {
  if (amount === 0) return "—"
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const STAGE_LABELS: Record<keyof ConstructionObject["stages"], string> = {
  production: "Производство",
  piles: "Устройство свай",
  shipment: "Отгрузка",
  windows: "Окна",
  windowsMount: "Монтаж окон",
  roof: "Кровля",
  electrical: "Электрика",
  plumbing: "Сантехника",
  screed: "Стяжка",
  exterior: "Наружка",
  handover: "Сдача",
}

const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200]

export default function SchedulePage() {
  const [filterPeriod, setFilterPeriod] = useState("2026-03")
  const [filterTerritory, setFilterTerritory] = useState(TERRITORY_ALL)
  const [filterType, setFilterType] = useState(TYPE_ALL)
  const [filterManager, setFilterManager] = useState(MANAGER_ALL)
  const [selectedObject, setSelectedObject] = useState<ConstructionObject | null>(null)

  const uniqueManagers = useMemo(() => {
    const set = new Set(MOCK_SCHEDULE_OBJECTS.map((o) => o.manager).filter(Boolean))
    return Array.from(set).sort()
  }, [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(17)
  const [pageSizeSelectValue, setPageSizeSelectValue] = useState("17")

  const setPageSizeAndSave = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(500, n))
    setPageSize(clamped)
    setPage(1)
    setPageSizeSelectValue(PAGE_SIZE_PRESETS.includes(clamped) ? String(clamped) : "custom")
  }, [])

  const filteredObjects = useMemo(() => {
    return MOCK_SCHEDULE_OBJECTS.filter((o) => {
      if (filterTerritory !== TERRITORY_ALL && o.territoryId !== filterTerritory) return false
      if (filterType !== TYPE_ALL && o.type !== filterType) return false
      if (filterManager !== MANAGER_ALL && o.manager !== filterManager) return false
      return true
    })
  }, [filterTerritory, filterType, filterManager])

  const totalPages = Math.max(1, Math.ceil(filteredObjects.length / pageSize))
  const startIdx = (page - 1) * pageSize
  const currentPageObjects = filteredObjects.slice(startIdx, startIdx + pageSize)

  useEffect(() => {
    if (filteredObjects.length > 0 && page > totalPages) setPage(1)
  }, [filteredObjects.length, page, totalPages])

  const handleResetFilters = useCallback(() => {
    setFilterPeriod("2026-03")
    setFilterTerritory(TERRITORY_ALL)
    setFilterType(TYPE_ALL)
    setFilterManager(MANAGER_ALL)
    setPage(1)
  }, [])

  const openDetail = (obj: ConstructionObject) => {
    setSelectedObject(obj)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">График монтажа</h1>
        <div className="mt-3 flex flex-col gap-3">
          {/* Форма фильтров */}
          <div
            className="grid min-h-[5rem] grid-cols-1 gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_auto_1fr_auto]"
          >
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Месяц</Label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger size="sm" className="h-8 w-[180px]">
                  <SelectValue placeholder="Месяц" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Насел. пункт</Label>
              <Select value={filterTerritory} onValueChange={(v) => { setFilterTerritory(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[220px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TERRITORY_ALL}>Все</SelectItem>
                  {TERRITORIES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name.length > 35 ? t.name.slice(0, 32) + "…" : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Тип</Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[120px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TYPE_ALL}>Все</SelectItem>
                  <SelectItem value="ПКД">ПКД</SelectItem>
                  <SelectItem value="МД">МД</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Прораб</Label>
              <Select value={filterManager} onValueChange={(v) => { setFilterManager(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[160px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANAGER_ALL}>Все</SelectItem>
                  {uniqueManagers.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={handleResetFilters} className="h-8">
                Сбросить
              </Button>
            </div>
          </div>

          {/* Таблица */}
          <div className="rounded-md border overflow-hidden">
            <ScheduleTable
              objects={currentPageObjects}
              onRowClick={openDetail}
              formatAmount={formatAmount}
            />
          </div>

          {/* Пагинация */}
          {filteredObjects.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={pageSizeSelectValue}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setPageSizeSelectValue("custom")
                      return
                    }
                    setPageSizeAndSave(Number(value))
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-[120px]">
                    <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_PRESETS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 overflow-hidden !w-[50vw] !max-w-[50vw] border-l"
          showCloseButton={false}
        >
          {selectedObject && (
            <>
              <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
                <div className="flex items-baseline justify-between gap-4">
                  <SheetTitle className="text-base font-semibold tracking-tight text-muted-foreground">
                    Объект графика
                  </SheetTitle>
                </div>
                <SheetDescription className="text-sm mt-1">
                  {selectedObject.location} — {selectedObject.orderCode}
                </SheetDescription>
                <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{selectedObject.project}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 font-normal text-xs",
                      selectedObject.type === "ПКД" &&
                        "border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
                      selectedObject.type === "МД" &&
                        "border-violet-500 dark:border-violet-400 bg-violet-50/30 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                    )}
                  >
                    {selectedObject.type === "ПКД" ? (
                      <IconLayoutGrid className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                    ) : (
                      <IconBox className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
                    )}
                    {selectedObject.type}
                  </Badge>
                  <span>№ дома {selectedObject.escrowEgrn}</span>
                </p>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-6 space-y-6">
                  <Card className="py-4">
                    <CardContent className="pt-0 px-6 pb-0">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Прораб
                          </p>
                          <p className="text-sm font-medium">
                            {selectedObject.manager}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Сумма
                          </p>
                          <p className="text-lg font-semibold tabular-nums whitespace-nowrap">
                            {formatAmount(selectedObject.amount)} ₽
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Дата запуска
                          </p>
                          <p className="text-sm tabular-nums">
                            {selectedObject.launchDate || "—"}
                          </p>
                        </div>
                        {selectedObject.documentNumber && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Документ
                            </p>
                            <p className="text-sm">
                              {selectedObject.documentNumber}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="py-4">
                        <CardHeader className="py-0 pb-1.5 px-6">
                          <CardTitle className="text-xs font-medium tracking-tight text-muted-foreground uppercase">
                            Этапы
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 px-6 pb-0">
                          <ul className="space-y-2">
                            {(Object.keys(STAGE_LABELS) as Array<keyof ConstructionObject["stages"]>).map(
                              (key) => {
                                const value = selectedObject.stages[key]
                                const alwaysShow =
                                  key === "shipment" ||
                                  key === "roof" ||
                                  key === "handover"
                                if (!value && !alwaysShow) return null
                                return (
                                  <li
                                    key={key}
                                    className="flex justify-between gap-4 text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {STAGE_LABELS[key]}
                                    </span>
                                    <span className="tabular-nums shrink-0">
                                      {value || "—"}
                                    </span>
                                  </li>
                                )
                              }
                            )}
                          </ul>
                        </CardContent>
                      </Card>

                  {selectedObject.statusComment && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Статус / комментарий
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words bg-muted/50 dark:bg-muted/30 px-3 py-2 rounded-md border">
                          {selectedObject.statusComment}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ScheduleTable({
  objects,
  onRowClick,
  formatAmount,
}: {
  objects: ConstructionObject[]
  onRowClick: (obj: ConstructionObject) => void
  formatAmount: (n: number) => string
}) {
  return (
    <div className="w-full">
      <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Насел. пункт</TableHead>
            <TableHead>Договор</TableHead>
            <TableHead className="text-right">№ дома</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Проект</TableHead>
            <TableHead>Прораб</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead>Отгрузка</TableHead>
            <TableHead>Кровля</TableHead>
            <TableHead>Сдача</TableHead>
            <TableHead className="max-w-[280px]">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="!h-24 text-center">
                <span className="text-muted-foreground text-sm">Нет объектов за выбранный период. Измените фильтры.</span>
              </TableCell>
            </TableRow>
          ) : (
          objects.map((obj) => (
            <TableRow
              key={obj.id}
              className="cursor-pointer"
              onClick={() => onRowClick(obj)}
            >
              <TableCell className="font-medium">{obj.location}</TableCell>
              <TableCell>{obj.orderCode}</TableCell>
              <TableCell className="text-right tabular-nums">
                {obj.escrowEgrn}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 font-normal",
                    obj.type === "ПКД" &&
                      "border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
                    obj.type === "МД" &&
                      "border-violet-500 dark:border-violet-400 bg-violet-50/30 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                  )}
                >
                  {obj.type === "ПКД" ? (
                    <IconLayoutGrid className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                  ) : (
                    <IconBox className="h-4 w-4 text-violet-500 dark:text-violet-400 shrink-0" />
                  )}
                  {obj.type}
                </Badge>
              </TableCell>
              <TableCell>{obj.project}</TableCell>
              <TableCell>{obj.manager}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(obj.amount)}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground text-xs">
                {obj.stages.shipment || "—"}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground text-xs">
                {obj.stages.roof || "—"}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground text-xs">
                {obj.stages.handover || "—"}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground text-xs">
                {obj.statusComment || "—"}
              </TableCell>
            </TableRow>
          )))
          }
        </TableBody>
      </Table>
    </div>
  )
}
