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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"
import type {
  ConstructionObjectApi,
  ConstructionObjectCreateBody,
  AddressCreateBody,
  EmployeeApi,
  ProjectCatalogApi,
  ContractApi,
} from "@/types/construction-schedule"

function formatAmount(n: number | null | undefined): string {
  if (n == null || n === 0) return "—"
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function ObjectsPage() {
  const [items, setItems] = useState<ConstructionObjectApi[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [selected, setSelected] = useState<ConstructionObjectApi | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [employees, setEmployees] = useState<EmployeeApi[]>([])
  const [projects, setProjects] = useState<ProjectCatalogApi[]>([])
  const [contracts, setContracts] = useState<ContractApi[]>([])

  const fetchObjects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set("q", searchQ.trim())
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    const res = await fetch(`/api/construction/objects?${params}`)
    if (!res.ok) {
      setItems([])
      setTotal(0)
      setLoading(false)
      return
    }
    const data = await res.json()
    setItems(data.items ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [searchQ, page, pageSize])

  useEffect(() => {
    fetchObjects()
  }, [fetchObjects])

  useEffect(() => {
    Promise.all([
      fetch("/api/construction/employees").then((r) => r.ok ? r.json() : []),
      fetch("/api/construction/project-catalog").then((r) => r.ok ? r.json() : []),
      fetch("/api/construction/contracts").then((r) => r.ok ? r.json() : []),
    ]).then(([emp, proj, cont]) => {
      setEmployees(Array.isArray(emp) ? emp : [])
      setProjects(Array.isArray(proj) ? proj : [])
      setContracts(Array.isArray(cont) ? cont : [])
    })
  }, [])

  const openCreate = () => {
    setSelected(null)
    setSheetMode("create")
    setSheetOpen(true)
  }
  const openEdit = (obj: ConstructionObjectApi) => {
    setSelected(obj)
    setSheetMode("edit")
    setSheetOpen(true)
  }

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open)
  }

  const onSaved = () => {
    fetchObjects()
    setSheetOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Объекты</h1>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <IconPlus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Создайте объект и укажите дату начала строительства (старта по договору). Дальше объект можно планировать в производство и в график монтажа.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Поиск по номеру договора или проекту..."
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setPage(1) }}
            className="max-w-sm"
          />
        </div>
        <div className="mt-3 rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Нет объектов. Добавьте первый объект или измените поиск.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Договор</TableHead>
                  <TableHead className="max-w-[280px]">Адрес</TableHead>
                  <TableHead>Дата старта</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Прораб</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(row)}
                  >
                    <TableCell className="font-medium">{row.contractNumber}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={row.addressDisplay ?? undefined}>
                      {row.addressDisplay ?? "—"}
                    </TableCell>
                    <TableCell>{row.contractStartDate ?? "—"}</TableCell>
                    <TableCell>{row.buildType ?? "—"}</TableCell>
                    <TableCell>{row.projectName ?? "—"}</TableCell>
                    <TableCell>{row.foremanName ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatAmount(row.amountCurrent ?? row.amountNext)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {total > pageSize && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            Показано {items.length} из {total}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent side="right" className="flex flex-col p-0 overflow-hidden border-l">
          <ObjectSheet
            mode={sheetMode}
            object={selected}
            employees={employees}
            projects={projects}
            contracts={contracts}
            onSaved={onSaved}
            onClose={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ObjectSheet({
  mode,
  object,
  employees,
  projects,
  contracts,
  onSaved,
  onClose,
}: {
  mode: "create" | "edit"
  object: ConstructionObjectApi | null
  employees: EmployeeApi[]
  projects: ProjectCatalogApi[]
  contracts: ContractApi[]
  onSaved: () => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [contractId, setContractId] = useState(object?.contractId ?? "")
  const [contractNumber, setContractNumber] = useState(object?.contractNumber ?? "")
  const [kitNo, setKitNo] = useState<number | "">(object?.kitNo ?? "")
  const [addressId, setAddressId] = useState(object?.addressId ?? "")
  const [addressDisplay, setAddressDisplay] = useState(object?.addressDisplay ?? "")
  const [addressSuggestQuery, setAddressSuggestQuery] = useState("")
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ value: string; data?: Record<string, unknown> }>>([])
  const [buildType, setBuildType] = useState(object?.buildType ?? "")
  const [projectId, setProjectId] = useState(object?.projectId ?? "")
  const [projectName, setProjectName] = useState(object?.projectName ?? "")
  const [foremanId, setForemanId] = useState(object?.foremanId ?? "")
  const [foremanName, setForemanName] = useState(object?.foremanName ?? "")
  const [amountCurrent, setAmountCurrent] = useState(object?.amountCurrent != null ? String(object.amountCurrent) : "")
  const [amountNext, setAmountNext] = useState(object?.amountNext != null ? String(object.amountNext) : "")
  const [contractStartDate, setContractStartDate] = useState(object?.contractStartDate ?? "")
  const [comment, setComment] = useState(object?.comment ?? "")

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
            setAddressSuggestions(data.suggestions.map((s: { value: string; data?: Record<string, unknown> }) => ({ value: s.value, data: s.data })))
          } else setAddressSuggestions([])
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
    const region = (d.region_with_type ?? d.region) as string | undefined
    const district = (d.area_with_type ?? d.area ?? d.city_district) as string | undefined
    const locality = (d.settlement_with_type ?? d.city_with_type ?? d.city ?? d.settlement) as string | undefined
    const street = (d.street_with_type ?? d.street) as string | undefined
    const house = (d.house ?? d.block) as string | undefined
    const parts = [region, district, locality, street, house].filter(Boolean) as string[]
    const fullText = parts.length > 0 ? parts.join(", ") : ((d.value ?? d.unrestricted_value) as string | undefined)
    const body: AddressCreateBody = {
      region,
      district,
      locality,
      street,
      house,
      fullText,
      kladrCode: d.kladr_id as string | undefined,
      fiasId: d.fias_id as string | undefined,
      isCustom: false,
    }
    try {
      const res = await fetch("/api/construction/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
    if (c.kitNo != null) setKitNo(c.kitNo)
    if (c.addressId) {
      setAddressId(c.addressId)
      setAddressDisplay(c.addressDisplay ?? "")
    }
    setBuildType(c.buildType ?? "")
    setProjectId(c.projectId ?? "")
    setProjectName(c.projectName ?? "")
    setForemanId(c.foremanId ?? "")
    setForemanName(c.foremanName ?? "")
    if (c.amount != null) setAmountCurrent(String(c.amount))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contractNumber.trim()) {
      toast.error("Укажите номер договора")
      return
    }
    setSaving(true)
    try {
      const body: ConstructionObjectCreateBody & { contractId?: string | null } = {
        addressId: addressId || null,
        contractId: contractId || null,
        contractNumber: contractNumber.trim(),
        kitNo: kitNo === "" ? null : Number(kitNo),
        buildType: buildType || null,
        projectId: projectId || null,
        projectName: projectName || null,
        foremanId: foremanId || null,
        foremanName: foremanName || null,
        amountCurrent: amountCurrent === "" ? null : Number(amountCurrent),
        amountNext: amountNext === "" ? null : Number(amountNext),
        contractStartDate: contractStartDate || null,
        comment: comment || null,
      }
      if (mode === "create") {
        const res = await fetch("/api/construction/objects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error ?? "Ошибка создания")
        toast.success("Объект создан")
      } else if (object?.id) {
        const res = await fetch(`/api/construction/objects/${object.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error ?? "Ошибка обновления")
        toast.success("Объект обновлён")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "create" ? "Новый объект" : "Редактирование объекта"
  const description = mode === "create"
    ? "Укажите договор, адрес и дату начала строительства (старта по договору)."
    : "Измените данные объекта."

  return (
    <>
      <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
        <SheetTitle className="text-base font-semibold tracking-tight text-muted-foreground">{title}</SheetTitle>
        <SheetDescription className="text-sm mt-1">{description}</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-auto px-6 pb-6 pt-4">
        <div className="space-y-2">
          <Label>Номер договора *</Label>
          <Input
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            placeholder="Например 101А/25"
            className="h-9"
            required
          />
          {contracts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contracts.slice(0, 8).map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectContract(c)}
                >
                  {c.contractNumber}
                </Button>
              ))}
            </div>
          )}
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
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => onSelectAddressSuggestion(s)}>
                    {s.value}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <Label>Дата начала строительства (старта по договору) *</Label>
          <Input
            type="date"
            value={contractStartDate}
            onChange={(e) => setContractStartDate(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Тип</Label>
            <Select value={buildType || "all"} onValueChange={(v) => setBuildType(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="ПКД / МД" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">—</SelectItem>
                <SelectItem value="ПКД">ПКД</SelectItem>
                <SelectItem value="МД">МД</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={projectId || "all"} onValueChange={(v) => { const p = projects.find((x) => x.id === v); setProjectId(v === "all" ? "" : v); setProjectName(p?.name ?? "") }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Проект" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">—</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Прораб</Label>
          <Select value={foremanId || "all"} onValueChange={(v) => { const e = employees.find((x) => x.id === v); setForemanId(v === "all" ? "" : v); setForemanName(e?.name ?? "") }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Прораб" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Сумма текущая</Label>
            <Input type="number" value={amountCurrent} onChange={(e) => setAmountCurrent(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Сумма следующая</Label>
            <Input type="number" value={amountNext} onChange={(e) => setAmountNext(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Комментарий</Label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} className="h-9" />
        </div>
        <div className="mt-auto flex gap-2 pt-4">
          <Button type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
        </div>
      </form>
    </>
  )
}
