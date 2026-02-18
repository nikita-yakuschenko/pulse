"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IconBox, IconChevronLeft, IconChevronRight, IconLayoutGrid } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import type {
  MountScheduleEntryApi,
  AddressApi,
  EmployeeApi,
  ProjectCatalogApi,
  ContractApi,
  MountScheduleListResponse,
  AddressCreateBody,
} from "@/types/construction-schedule"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus } from "@tabler/icons-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TYPE_ALL = "all"
const ADDRESS_ALL = "all"
const FOREMAN_ALL = "all"

function formatAmount(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return "—"
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, "0")}`
    const label = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

const MONTH_OPTIONS = getMonthOptions()

function getDefaultPlanMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function SchedulePage() {
  const [items, setItems] = useState<MountScheduleEntryApi[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterPlanMonth, setFilterPlanMonth] = useState(getDefaultPlanMonth)
  const [filterAddress, setFilterAddress] = useState(ADDRESS_ALL)
  const [filterType, setFilterType] = useState(TYPE_ALL)
  const [filterForeman, setFilterForeman] = useState(FOREMAN_ALL)
  const [addresses, setAddresses] = useState<Array<AddressApi & { displayFull?: string | null }>>([])
  const [employees, setEmployees] = useState<EmployeeApi[]>([])
  const [projects, setProjects] = useState<ProjectCatalogApi[]>([])
  const [contracts, setContracts] = useState<ContractApi[]>([])
  const [selectedEntry, setSelectedEntry] = useState<MountScheduleEntryApi | null>(null)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [page, setPage] = useState(1)

  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave: setPageSizeAndSaveBase,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("construction-schedule-page-size")
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

  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))

  const fetchSchedule = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("planMonth", filterPlanMonth)
      if (filterAddress && filterAddress !== ADDRESS_ALL) params.set("address", filterAddress)
      if (filterType && filterType !== TYPE_ALL) params.set("type", filterType)
      if (filterForeman && filterForeman !== FOREMAN_ALL) params.set("foreman", filterForeman)
      params.set("page", String(page))
      params.set("pageSize", String(effectivePageSize))
      const res = await fetch(`/api/construction/mount-schedule?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? "Ошибка загрузки")
      }
      const data: MountScheduleListResponse = await res.json()
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить график")
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterPlanMonth, filterAddress, filterType, filterForeman, page, effectivePageSize])

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/construction/addresses")
      if (!res.ok) return
      const data = await res.json()
      setAddresses(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/construction/employees")
      if (!res.ok) return
      const data = await res.json()
      setEmployees(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/construction/project-catalog")
      if (!res.ok) return
      const data = await res.json()
      setProjects(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/construction/contracts")
      if (!res.ok) return
      const data = await res.json()
      setContracts(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  useEffect(() => {
    fetchAddresses()
    fetchEmployees()
    fetchProjects()
    fetchContracts()
  }, [fetchAddresses, fetchEmployees, fetchProjects, fetchContracts])

  useEffect(() => {
    if (page > totalPages && total > 0) setPage(1)
  }, [page, totalPages, total])

  useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto") {
      setPageSizeSelectValue("17")
    }
  }, [autoPageSize, pageSizeSelectValue, setPageSizeSelectValue])

  const handleResetFilters = useCallback(() => {
    setFilterPlanMonth(getDefaultPlanMonth())
    setFilterAddress(ADDRESS_ALL)
    setFilterType(TYPE_ALL)
    setFilterForeman(FOREMAN_ALL)
    setPage(1)
  }, [])

  const openCreate = () => {
    setSelectedEntry(null)
    setSheetMode("create")
    setSheetOpen(true)
  }

  const openEdit = (entry: MountScheduleEntryApi) => {
    setSelectedEntry(entry)
    setSheetMode("edit")
    setSheetOpen(true)
  }

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open)
    if (!open) setSelectedEntry(null)
  }

  const onSaved = useCallback(() => {
    fetchSchedule()
    fetchAddresses()
  }, [fetchSchedule, fetchAddresses])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">График монтажа</h1>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <IconPlus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid min-h-[5rem] grid-cols-1 gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_auto_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Месяц</Label>
              <Select value={filterPlanMonth} onValueChange={(v) => { setFilterPlanMonth(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[180px]">
                  <SelectValue placeholder="Месяц" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Адрес</Label>
              <Select value={filterAddress} onValueChange={(v) => { setFilterAddress(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[220px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ADDRESS_ALL}>Все</SelectItem>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {((a as { displayFull?: string }).displayFull ?? a.fullText ?? a.locality ?? a.id).slice(0, 50)}
                      {((a as { displayFull?: string }).displayFull ?? a.fullText ?? "").length > 50 ? "…" : ""}
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
              <Select value={filterForeman} onValueChange={(v) => { setFilterForeman(v); setPage(1) }}>
                <SelectTrigger size="sm" className="h-8 w-[160px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FOREMAN_ALL}>Все</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
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

          <div ref={tableContainerRef} className="flex flex-col gap-3">
            <div className="rounded-md border overflow-hidden">
              {loading ? (
                <TableSkeleton columnCount={11} rowCount={10} />
              ) : (
                <ScheduleTable
                  items={items}
                  onRowClick={openEdit}
                  formatAmount={formatAmount}
                />
              )}
            </div>
          </div>

          {!loading && (items.length > 0 || total > 0) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={pageSizeSelectValue}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setPageSizeSelectValue("custom")
                      return
                    }
                    if (value === "auto") {
                      setPageSizeSelectValue("auto")
                      setPage(1)
                      return
                    }
                    setPageSizeAndSave(Number(value))
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-[120px]">
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
                  Страница {page} из {totalPages} · всего {total}
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

      <Sheet open={sheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 overflow-hidden border-l w-full sm:max-w-xl"
          showCloseButton={false}
        >
          <ScheduleSheet
            mode={sheetMode}
            entry={selectedEntry}
            employees={employees}
            projects={projects}
            contracts={contracts}
            onSaved={onSaved}
            onClose={() => setSheetOpen(false)}
            formatAmount={formatAmount}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ScheduleTable({
  items,
  onRowClick,
  formatAmount,
}: {
  items: MountScheduleEntryApi[]
  onRowClick: (entry: MountScheduleEntryApi) => void
  formatAmount: (n: number | null | undefined) => string
}) {
  return (
    <div className="w-full">
      <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Адрес</TableHead>
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
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="!h-24 text-center">
                <span className="text-muted-foreground text-sm">Нет записей за выбранный месяц. Измените фильтры или добавьте запись.</span>
              </TableCell>
            </TableRow>
          ) : (
            items.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onRowClick(row)}
              >
                <TableCell className="font-medium max-w-[180px] truncate" title={row.addressDisplay ?? undefined}>
                  {row.addressDisplay ?? "—"}
                </TableCell>
                <TableCell>{row.contractNumber}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.houseNo ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 font-normal",
                      row.buildType === "ПКД" &&
                        "border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
                      row.buildType === "МД" &&
                        "border-violet-500 dark:border-violet-400 bg-violet-50/30 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                    )}
                  >
                    {row.buildType === "ПКД" ? (
                      <IconLayoutGrid className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    ) : (
                      <IconBox className="h-4 w-4 text-violet-500 dark:text-violet-400 shrink-0" />
                    )}
                    {row.buildType ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell>{row.projectName ?? "—"}</TableCell>
                <TableCell>{row.foremanName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(row.amountDisplay)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground text-xs">
                  {row.shipmentDate ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground text-xs">
                  {row.roofWorkDate ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground text-xs">
                  {row.handoverDate ?? "—"}
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground text-xs" title={row.statusSummary ?? undefined}>
                  {row.statusSummary ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ScheduleSheet({
  mode,
  entry,
  employees,
  projects,
  contracts,
  onSaved,
  onClose,
  formatAmount,
}: {
  mode: "create" | "edit"
  entry: MountScheduleEntryApi | null
  employees: EmployeeApi[]
  projects: ProjectCatalogApi[]
  contracts: ContractApi[]
  onSaved: () => void
  onClose: () => void
  formatAmount: (n: number | null | undefined) => string
}) {
  const [saving, setSaving] = useState(false)
  const [planMonth, setPlanMonth] = useState(entry?.planMonth ?? getDefaultPlanMonth())
  const [contractId, setContractId] = useState(entry?.contractId ?? "")
  const [contractNumber, setContractNumber] = useState(entry?.contractNumber ?? "")
  const [houseNo, setHouseNo] = useState<number | "">(entry?.houseNo ?? "")
  const [addressId, setAddressId] = useState(entry?.addressId ?? "")
  const [addressDisplay, setAddressDisplay] = useState(entry?.addressDisplay ?? "")
  const [addressSuggestQuery, setAddressSuggestQuery] = useState("")
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ value: string; data?: Record<string, unknown> }>>([])
  const [buildType, setBuildType] = useState(entry?.buildType ?? "")
  const [projectId, setProjectId] = useState(entry?.projectId ?? "")
  const [projectName, setProjectName] = useState(entry?.projectName ?? "")
  const [foremanId, setForemanId] = useState(entry?.foremanId ?? "")
  const [foremanName, setForemanName] = useState(entry?.foremanName ?? "")
  const [amountCurrent, setAmountCurrent] = useState(entry?.amountCurrent != null ? String(entry.amountCurrent) : "")
  const [amountNext, setAmountNext] = useState(entry?.amountNext != null ? String(entry.amountNext) : "")
  const [productionLaunchDate, setProductionLaunchDate] = useState(entry?.productionLaunchDate ?? "")
  const [shipmentDate, setShipmentDate] = useState(entry?.shipmentDate ?? "")
  const [roofWorkDate, setRoofWorkDate] = useState(entry?.roofWorkDate ?? "")
  const [handoverDate, setHandoverDate] = useState(entry?.handoverDate ?? "")
  const [productionStatus, setProductionStatus] = useState(entry?.productionStatus ?? "")
  const [statusSummaryOverride, setStatusSummaryOverride] = useState(entry?.statusSummaryOverride ?? "")
  const [comment, setComment] = useState(entry?.comment ?? "")

  useEffect(() => {
    if (!addressSuggestQuery.trim()) {
      setAddressSuggestions([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/construction/addresses/suggest?q=${encodeURIComponent(addressSuggestQuery)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.suggestions) {
            setAddressSuggestions(
              data.suggestions.map((s: { value: string; data?: Record<string, unknown> }) => ({
                value: s.value,
                data: s.data,
              }))
            )
          } else {
            setAddressSuggestions([])
          }
        })
        .catch(() => setAddressSuggestions([]))
    }, 300)
    return () => clearTimeout(t)
  }, [addressSuggestQuery])

  const onSelectAddressSuggestion = useCallback(async (suggestion: { value: string; data?: Record<string, unknown> }) => {
    const d = suggestion.data
    if (!d) {
      setAddressDisplay(suggestion.value)
      setAddressSuggestQuery(suggestion.value)
      setAddressSuggestions([])
      return
    }
    const body: AddressCreateBody = {
      region: (d.region ?? d.region_with_type) as string | undefined,
      district: (d.area ?? d.city_district) as string | undefined,
      locality: (d.city ?? d.settlement) as string | undefined,
      street: (d.street ?? d.street_with_type) as string | undefined,
      house: (d.house ?? d.block) as string | undefined,
      fullText: (d.value ?? d.unrestricted_value) as string | undefined,
      kladrCode: d.kladr_id as string | undefined,
      fiasId: d.fias_id as string | undefined,
      isCustom: false,
    }
    try {
      const res = await fetch("/api/construction/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Не удалось сохранить адрес")
      const created = await res.json()
      setAddressId(created.id)
      setAddressDisplay(created.displayFull ?? created.fullText ?? suggestion.value)
      setAddressSuggestQuery("")
      setAddressSuggestions([])
    } catch {
      toast.error("Не удалось сохранить адрес")
    }
  }, [])

  const onSelectContract = useCallback((c: ContractApi) => {
    setContractId(c.id)
    setContractNumber(c.contractNumber)
    if (c.houseNo != null) setHouseNo(c.houseNo)
    if (c.addressId) {
      setAddressId(c.addressId)
      setAddressDisplay(c.addressDisplay ?? "")
    }
    if (c.buildType) setBuildType(c.buildType)
    if (c.projectId) {
      setProjectId(c.projectId)
      setProjectName(c.projectName ?? "")
    }
    if (c.foremanId) {
      setForemanId(c.foremanId)
      setForemanName(c.foremanName ?? "")
    }
    if (c.amount != null) setAmountCurrent(String(c.amount))
  }, [])

  const handleSubmit = useCallback(async () => {
    const cnTrim = contractNumber.trim()
    if (!cnTrim) {
      toast.error("Укажите номер договора")
      return
    }
    setSaving(true)
    try {
      const payload = {
        planMonth,
        contractId: contractId || undefined,
        contractNumber: cnTrim,
        houseNo: houseNo === "" ? undefined : Number(houseNo),
        addressId: addressId || undefined,
        buildType: buildType || undefined,
        projectId: projectId || undefined,
        projectName: projectName || undefined,
        foremanId: foremanId || undefined,
        foremanName: foremanName || undefined,
        amountCurrent: amountCurrent === "" ? undefined : parseFloat(amountCurrent),
        amountNext: amountNext === "" ? undefined : parseFloat(amountNext),
        productionLaunchDate: productionLaunchDate || undefined,
        shipmentDate: shipmentDate || undefined,
        roofWorkDate: roofWorkDate || undefined,
        handoverDate: handoverDate || undefined,
        productionStatus: productionStatus || undefined,
        statusSummaryOverride: statusSummaryOverride || undefined,
        comment: comment || undefined,
      }
      if (mode === "create") {
        const res = await fetch("/api/construction/mount-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? "Ошибка создания")
        }
        toast.success("Запись добавлена в график")
      } else if (entry) {
        const res = await fetch(`/api/construction/mount-schedule/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? "Ошибка обновления")
        }
        toast.success("Запись обновлена")
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }, [
    mode,
    entry,
    planMonth,
    contractId,
    contractNumber,
    houseNo,
    addressId,
    buildType,
    projectId,
    projectName,
    foremanId,
    foremanName,
    amountCurrent,
    amountNext,
    productionLaunchDate,
    shipmentDate,
    roofWorkDate,
    handoverDate,
    productionStatus,
    statusSummaryOverride,
    comment,
    onSaved,
    onClose,
  ])

  const title = mode === "create" ? "Добавить запись" : "Редактировать запись"
  const description = mode === "edit" && entry
    ? `${entry.addressDisplay ?? "—"} — ${entry.contractNumber}`
    : "Заполните поля и сохраните."

  return (
    <>
      <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
        <SheetTitle className="text-base font-semibold tracking-tight text-muted-foreground">
          {title}
        </SheetTitle>
        <SheetDescription className="text-sm mt-1">{description}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Общие</TabsTrigger>
              <TabsTrigger value="finance">Финансы</TabsTrigger>
              <TabsTrigger value="production">Производство / Монтаж</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>План-месяц (YYYY-MM)</Label>
                <Input
                  type="month"
                  value={planMonth}
                  onChange={(e) => setPlanMonth(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Договор</Label>
                <Select
                  value={contractId || "_"}
                  onValueChange={(v) => {
                    if (v === "_") {
                      setContractId("")
                      setContractNumber("")
                      return
                    }
                    const c = contracts.find((x) => x.id === v)
                    if (c) onSelectContract(c)
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите договор" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— Не выбран</SelectItem>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber}
                        {c.addressDisplay ? ` · ${c.addressDisplay.slice(0, 30)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Номер договора"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>№ дома</Label>
                  <Input
                    type="number"
                    value={houseNo === "" ? "" : houseNo}
                    onChange={(e) => setHouseNo(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Адрес</Label>
                <Input
                  placeholder="Начните ввод для подсказок DaData"
                  value={addressSuggestQuery || addressDisplay}
                  onChange={(e) => {
                    setAddressSuggestQuery(e.target.value)
                    if (!addressDisplay || !e.target.value) setAddressDisplay(e.target.value)
                  }}
                  className="h-9"
                />
                {addressSuggestions.length > 0 && (
                  <ul className="border rounded-md divide-y max-h-48 overflow-auto bg-background">
                    {addressSuggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => onSelectAddressSuggestion(s)}
                        >
                          {s.value}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {addressId && addressDisplay && (
                  <p className="text-xs text-muted-foreground">Выбран: {addressDisplay}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select value={buildType || "all"} onValueChange={(v) => setBuildType(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="ПКД / МД" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">—</SelectItem>
                      <SelectItem value="ПКД">ПКД</SelectItem>
                      <SelectItem value="МД">МД</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Проект</Label>
                  <Select value={projectId || "_"} onValueChange={(v) => {
                    setProjectId(v === "_" ? "" : v)
                    const p = projects.find((x) => x.id === v)
                    setProjectName(p?.name ?? "")
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Проект" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Прораб</Label>
                <Select value={foremanId || "_"} onValueChange={(v) => {
                  setForemanId(v === "_" ? "" : v)
                  const e = employees.find((x) => x.id === v)
                  setForemanName(e?.name ?? "")
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Прораб" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="finance" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Сумма (текущий месяц)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountCurrent}
                  onChange={(e) => setAmountCurrent(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Перенос на следующий месяц (сумма)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountNext}
                  onChange={(e) => setAmountNext(e.target.value)}
                  className="h-9"
                />
              </div>
            </TabsContent>
            <TabsContent value="production" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Дата запуска в производство</Label>
                <Input
                  type="date"
                  value={productionLaunchDate}
                  onChange={(e) => setProductionLaunchDate(e.target.value)}
                  min="2020-01-01"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Статус производства</Label>
                <Input
                  value={productionStatus}
                  onChange={(e) => setProductionStatus(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Дата отгрузки</Label>
                <Input
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  min="2020-01-01"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Дата кровли</Label>
                <Input
                  type="date"
                  value={roofWorkDate}
                  onChange={(e) => setRoofWorkDate(e.target.value)}
                  min="2020-01-01"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Дата сдачи</Label>
                <Input
                  type="date"
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  min="2020-01-01"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Переопределение статуса (кратко)</Label>
                <Input
                  value={statusSummaryOverride}
                  onChange={(e) => setStatusSummaryOverride(e.target.value)}
                  placeholder="Или оставьте пустым для автособорки"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Комментарий</Label>
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="h-9"
                />
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-2 pt-6 pb-4">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
