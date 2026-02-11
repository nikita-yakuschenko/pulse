"use client"

import { useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IconBox, IconLayoutGrid } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TERRITORIES, MOCK_SCHEDULE_OBJECTS } from "@/lib/mock-construction-schedule"
import type { ConstructionObject } from "@/types/construction-schedule"
import { cn } from "@/lib/utils"

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

export default function SchedulePage() {
  const [period, setPeriod] = useState("2026-03")
  const [selectedObject, setSelectedObject] = useState<ConstructionObject | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  const objectsByTerritory = useMemo(() => {
    const map = new Map<string, ConstructionObject[]>()
    map.set("all", MOCK_SCHEDULE_OBJECTS)
    for (const t of TERRITORIES) {
      map.set(
        t.id,
        MOCK_SCHEDULE_OBJECTS.filter((o) => o.territoryId === t.id)
      )
    }
    return map
  }, [])

  const openDetail = (obj: ConstructionObject) => {
    setSelectedObject(obj)
    setSheetOpen(true)
  }

  return (
    <div className="min-w-0 w-full px-4 py-8">
      <h1 className="text-2xl font-bold">График монтажа</h1>
      <p className="mt-2 text-muted-foreground">
        График производства работ по монтажу. План по месяцам, группировка по
        территориям.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026-03">Март 2026</SelectItem>
            <SelectItem value="2026-04">Апрель 2026</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Все</TabsTrigger>
            {TERRITORIES.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.name.length > 25 ? t.name.slice(0, 22) + "…" : t.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {(["all", ...TERRITORIES.map((t) => t.id)] as const).map((tabId) => (
            <TabsContent key={tabId} value={tabId} className="mt-4">
              <ScheduleTable
                objects={objectsByTerritory.get(tabId) ?? []}
                onRowClick={openDetail}
                formatAmount={formatAmount}
              />
            </TabsContent>
          ))}
        </Tabs>
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

                  {(() => {
                    const hasStages = (Object.keys(STAGE_LABELS) as Array<keyof ConstructionObject["stages"]>).some(
                      (key) => selectedObject.stages[key]
                    )
                    if (!hasStages) return null
                    return (
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
                    )
                  })()}

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
  if (objects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        Нет объектов за выбранный период
      </div>
    )
  }
  return (
    <div className="w-full rounded-lg border">
      <Table>
        <TableHeader>
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
          {objects.map((obj) => (
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

