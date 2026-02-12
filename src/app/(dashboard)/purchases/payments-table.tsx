"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconLoader, IconChevronLeft, IconChevronRight, IconCopy, IconX, IconCircleCheckFilled, IconAlertCircle, IconBolt, IconCheck, IconSelector, IconFile, IconEye, IconArrowLeft, IconPrinter, IconDownload, IconRotateClockwise2, IconRotate2 } from "@tabler/icons-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import dynamic from "next/dynamic"
import { cn, formatDate } from "@/lib/utils"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import { useTablePageSizePreference } from "@/hooks/use-table-page-size-preference"
import type { Payment, PaymentDetails, SupplierOrderAttachment } from "@/types/1c"
import { OfficeViewer } from "@/components/office-viewer"

// pdfjs-dist падает на сервере (Object.defineProperty) — подключаем только на клиенте
const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => ({ default: m.PdfViewer })),
  { ssr: false }
)

/**
 * Парсит дату из формата "09.06.2023 10:59:09" в Date
 */
function parseDate(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split(" ")
  const [day, month, year] = datePart.split(".").map(Number)
  const [hours, minutes, seconds] = timePart.split(":").map(Number)
  return new Date(year, month - 1, day, hours, minutes, seconds)
}

/**
 * Извлекает год из даты в формате "09.06.2023 10:59:09" → "23"
 */
function extractYear(dateStr: string): string {
  const [datePart] = dateStr.split(" ")
  const [, , year] = datePart.split(".")
  return year.slice(-2)
}

/**
 * Форматирует сумму для отображения (без валюты)
 */
function formatSum(sum: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(sum)
}

/** Можно ли показать файл в диалоге (PDF или изображение). */
function getFilePreviewKind(fileName: string): "pdf" | "image" | "office" | "other" {
  const lower = (fileName || "").toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => lower.endsWith(ext))) return "image"
  if ([".xls", ".xlsx", ".doc", ".docx", ".rtf"].some((ext) => lower.endsWith(ext))) return "office"
  return "other"
}

/** MIME-тип по расширению имени файла. */
function getMimeType(fileName: string): string {
  const lower = (fileName || "").toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".webp")) return "image/webp"
  return "application/octet-stream"
}

/** Data URL из вложения, если есть ФайлBase64 (ответ 1С при full=1). Иначе null. */
function dataUrlFromAttachment(att: SupplierOrderAttachment): string | null {
  if (!att.ФайлBase64) return null
  const mime = getMimeType(att.ИмяФайла || "")
  return `data:${mime};base64,${att.ФайлBase64}`
}

/** URL для открытия в новой вкладке или iframe: data URL → blob URL (браузер блокирует data URL в top frame). */
async function urlForNewTab(url: string, fileName?: string): Promise<string> {
  if (!url.startsWith("data:")) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const file = fileName ? new File([blob], fileName, { type: blob.type }) : blob
    return URL.createObjectURL(file)
  } catch {
    return url
  }
}

/** Экранирование имени файла для подстановки в HTML (title). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Открывает штатный диалог печати браузера для PDF (скрытый iframe → print()). */
async function printPdfDialog(pdfUrl: string, fileName: string): Promise<void> {
  const url = await urlForNewTab(pdfUrl, fileName)
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.inset = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "none"
  iframe.style.pointerEvents = "none"
  iframe.src = url
  document.body.appendChild(iframe)

  const cleanup = () => {
    try {
      document.body.removeChild(iframe)
    } catch {}
    if (url.startsWith("blob:")) URL.revokeObjectURL(url)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.print()
    } catch (e) {
      console.error("Print error:", e)
    }
    setTimeout(cleanup, 60_000)
  }
  iframe.onerror = () => cleanup()
}

/**
 * Кнопка для очистки поля ввода
 */
function ClearInputButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-300"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

/**
 * Кнопка для очистки фильтра (для Select)
 */
function ClearFilterButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="rounded p-0.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-300"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

/** Секция расшифровки платежа (табличная часть) */
function PaymentLinesSection({ title, items }: { title: string; items: import("@/types/1c").PaymentLineItem[] }) {
  const gridCols = "24px minmax(180px, 1fr) 125px"
  return (
    <Card className="overflow-hidden gap-1.5 py-4">
      <CardHeader className="py-0 pb-1.5 px-6">
        <CardTitle className="text-xs font-medium tracking-tight text-muted-foreground uppercase">
          {title}
          <span className="ml-2 font-normal normal-case text-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-6 pb-0">
        <div className="rounded-lg border bg-muted/20 overflow-x-auto">
          <div className="min-w-[400px]">
            <div
              className="grid gap-x-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b font-medium"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span>№</span>
              <span>Документ</span>
              <span className="text-right">Сумма</span>
            </div>
            {items.map((item, i) => (
              <div
                key={item.НомерСтроки ?? i}
                className={cn(
                  "grid gap-x-3 px-4 py-4 text-sm",
                  i < items.length - 1 && "border-b border-border/50"
                )}
                style={{ gridTemplateColumns: gridCols, alignItems: "baseline" }}
              >
                <span className="text-muted-foreground tabular-nums">{item.НомерСтроки ?? i + 1}</span>
                <div className="min-w-0 break-words">
                  <div className="font-medium">{item.Документ}</div>
                  {item.Назначение?.trim() ? (
                    <div className="text-xs text-muted-foreground mt-1">{item.Назначение}</div>
                  ) : null}
                </div>
                <span className="text-right tabular-nums font-semibold whitespace-nowrap shrink-0">{formatSum(item.Сумма)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PaymentsTable() {
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [page, setPage] = useState(1)
  const {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave: setPageSizeAndSaveBase,
    setPageSizeSelectValue,
    PAGE_SIZE_PRESETS,
  } = useTablePageSizePreference("payments-page-size")
  const setPageSizeAndSave = useCallback(
    (n: number) => {
      setPageSizeAndSaveBase(n)
      setPage(1)
    },
    [setPageSizeAndSaveBase]
  )

  // Фильтры для API (серверная фильтрация)
  const [filterCode, setFilterCode] = useState("")
  const [filterContractor, setFilterContractor] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Фильтры для клиентской фильтрации
  const [filterOrganization, setFilterOrganization] = useState("")
  const [filterResponsible, setFilterResponsible] = useState("")

  // Состояние для combobox контрагентов
  const [contractorComboboxOpen, setContractorComboboxOpen] = useState(false)

  // Состояние для Sheet с подробной информацией о заявке на оплату
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Просмотр вложения на весь Sheet: список вложений и текущий индекс
  const [attachmentPreview, setAttachmentPreview] = useState<{
    attachments: SupplierOrderAttachment[]
    index: number
  } | null>(null)

  // Масштаб для PDF
  const [pdfZoom, setPdfZoom] = useState(1.0)

  // Угол поворота для изображений (в градусах) - сохраняется по ключу ИдентификаторХранилища
  const [imageRotations, setImageRotations] = useState<Record<string, number>>({})

  // Флаг завершения первоначальной загрузки (для useEffect-ов автоматической фильтрации)
  const isInitialLoadDone = useRef(false)

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const autoPageSize = useTableAutoPageSize(tableContainerRef)
  const useAutoSize = pageSizeSelectValue === "auto" && autoPageSize > 0
  const effectivePageSize = useAutoSize ? autoPageSize : pageSize

  // Накопление уникальных значений для фильтров (чтобы не пересчитывать при каждом обновлении)
  const optionsAccumulator = useRef<{
    contractors: Set<string>
    orgs: Set<string>
    resps: Set<string>
    statuses: Set<string>
    years: Set<string>
  }>({
    contractors: new Set(),
    orgs: new Set(),
    resps: new Set(),
    statuses: new Set(),
    years: new Set(),
  })

  type PaymentsFilters = {
    code: string
    contractor: string
    year: string
    org: string
    responsible: string
    status: string
  }

  // Загрузка данных (как в Заказах поставщикам: текстовые фильтры code/contractor применяются вручную — Enter или выбор из dropdown)
  const loadPayments = useCallback(async (overrides?: Partial<PaymentsFilters>) => {
    setLoading(true)
    try {
      const code = overrides?.code ?? filterCode
      const contractor = overrides?.contractor ?? filterContractor
      const year = overrides?.year ?? filterYear
      const org = overrides?.org ?? filterOrganization
      const responsible = overrides?.responsible ?? filterResponsible
      const status = overrides?.status ?? filterStatus

      const params = new URLSearchParams()
      if (code.trim()) params.set("code", code.trim())
      if (contractor.trim()) params.set("contractor", contractor.trim())
      if (org.trim()) params.set("org", org.trim())
      if (responsible.trim()) params.set("responsible", responsible.trim())
      if (status.trim()) params.set("status", status.trim())

      const url = `/api/1c/payments${params.toString() ? `?${params.toString()}` : ""}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      let paymentsData: Payment[] = data.data || []

      // Клиентская фильтрация по году (API не поддерживает)
      if (year.trim()) {
        paymentsData = paymentsData.filter((p) => extractYear(p.Дата) === year.trim())
      }

      setPayments(paymentsData)
      setPage(1)
    } catch (error) {
      console.error("Ошибка загрузки оплат:", error)
      toast.error("Не удалось загрузить оплаты")
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [filterCode, filterContractor, filterYear, filterOrganization, filterResponsible, filterStatus])

  // Первоначальная загрузка — загружаем все данные для сбора опций dropdown-ов
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/1c/payments")
        const data = await res.json()
        if (res.ok && data.data) {
          data.data.forEach((p: Payment) => {
            if (p.Контрагент) optionsAccumulator.current.contractors.add(p.Контрагент)
            if (p.Организация) optionsAccumulator.current.orgs.add(p.Организация)
            if (p.Ответственный) optionsAccumulator.current.resps.add(p.Ответственный)
            if (p.Статус) optionsAccumulator.current.statuses.add(p.Статус)
            const year = extractYear(p.Дата)
            if (year) optionsAccumulator.current.years.add(year)
          })
        }
        await loadPayments()
        isInitialLoadDone.current = true
      } catch (error) {
        console.error("Ошибка первоначальной загрузки оплат:", error)
        setLoading(false)
      }
    }
    loadInitial()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Автоматическая загрузка при изменении фильтров Год, Организация, Ответственный, Статус (НЕ code/contractor — они по Enter)
  useEffect(() => {
    if (!isInitialLoadDone.current) return
    loadPayments()
  }, [filterYear, filterOrganization, filterResponsible, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // При каждой загрузке дополняем накопленные опции (как в Заказах поставщикам)
  useEffect(() => {
    payments.forEach((payment) => {
      if (payment.Контрагент) optionsAccumulator.current.contractors.add(payment.Контрагент)
      if (payment.Организация) optionsAccumulator.current.orgs.add(payment.Организация)
      if (payment.Ответственный) optionsAccumulator.current.resps.add(payment.Ответственный)
      if (payment.Статус) optionsAccumulator.current.statuses.add(payment.Статус)
      const year = extractYear(payment.Дата)
      if (year) optionsAccumulator.current.years.add(year)
    })
  }, [payments])

  // Опции для dropdown-ов — из накопленного набора (как в Заказах поставщикам)
  const uniqueContractors = useMemo(
    () => Array.from(optionsAccumulator.current.contractors).sort(),
    [payments]
  )
  const uniqueOrganizations = useMemo(
    () => Array.from(optionsAccumulator.current.orgs).sort(),
    [payments]
  )
  const uniqueResponsibles = useMemo(
    () => Array.from(optionsAccumulator.current.resps).sort(),
    [payments]
  )
  const uniqueYears = useMemo(
    () => Array.from(optionsAccumulator.current.years).sort().reverse(),
    [payments]
  )
  const uniqueStatuses = useMemo(
    () => Array.from(optionsAccumulator.current.statuses).sort(),
    [payments]
  )

  // Отфильтрованные данные с сортировкой по дате (от новых к старым)
  // Фильтрация по org и responsible теперь делается на сервере через API
  const filteredPayments = useMemo(() => {
    let result = [...payments]

    // Сортировка по дате: от новых к старым (убывание)
    result.sort((a, b) => {
      const dateA = parseDate(a.Дата)
      const dateB = parseDate(b.Дата)
      return dateB.getTime() - dateA.getTime() // убывание: более новая дата идет первой
    })

    return result
  }, [payments])

  // На мобильной ширине сбрасываем «Авто»
  useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto") {
      setPageSizeSelectValue("17")
    }
  }, [autoPageSize, pageSizeSelectValue])

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / effectivePageSize))
  // Сбрасываем страницу, если текущая страница больше общего количества страниц
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1)
    }
  }, [page, totalPages])
  const startIndex = (page - 1) * effectivePageSize
  const endIndex = startIndex + effectivePageSize
  const currentPayments = filteredPayments.slice(startIndex, endIndex)

  // Сброс всех фильтров — очищаем состояние и перезагружаем данные без фильтров
  const handleResetFilters = useCallback(() => {
    setFilterCode("")
    setFilterContractor("")
    setFilterYear("")
    setFilterOrganization("")
    setFilterResponsible("")
    setFilterStatus("")
    setPage(1)
    loadPayments({ code: "", contractor: "", year: "", org: "", responsible: "", status: "" })
  }, [loadPayments])

  // Применение текстовых фильтров (Номер, Поставщик) — по Enter или выбору из dropdown
  const handleApplyFilters = useCallback(() => {
    loadPayments()
  }, [loadPayments])

  // Открытие Sheet с подробной информацией о заявке на оплату
  const openPaymentDetails = useCallback(async (payment: Payment) => {
    setSelectedPayment(payment)
    setSheetOpen(true)
    setDetailsLoading(true)
    setPaymentDetails(null)

    try {
      // Загружаем подробную информацию с параметром full=1
      const params = new URLSearchParams()
      params.set("code", payment.Номер)
      params.set("full", "1")

      const res = await fetch(`/api/1c/payments?${params}`)
      const data = await res.json()

      if (res.ok && data.data && data.data.length > 0) {
        setPaymentDetails(data.data[0])
      } else {
        // Если не удалось загрузить подробности, используем базовую информацию
        setPaymentDetails(payment as PaymentDetails)
      }
    } catch (error) {
      console.error("Ошибка загрузки подробностей заявки:", error)
      setPaymentDetails(payment as PaymentDetails)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {/* Filters - inline row */}
      <div
        className="grid min-h-[5rem] grid-cols-[auto_auto_auto_auto_auto_auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3"
        style={{ gridTemplateRows: "auto 32px" }}
      >
        {/* Строка 1: все метки. Строка 2: все контролы (высота 32px) */}
        <Label htmlFor="filter-code" className="text-xs text-muted-foreground">
          Номер
        </Label>
        <Label htmlFor="filter-contractor" className="text-xs text-muted-foreground">
          Поставщик
        </Label>
        <Label className="text-xs text-muted-foreground">Год</Label>
        <Label className="text-xs text-muted-foreground">Организация</Label>
        <Label className="text-xs text-muted-foreground">Ответственный</Label>
        <Label className="text-xs text-muted-foreground">Статус</Label>
        <div />
        <div />

        <div className="relative w-[160px]">
          <Input
            id="filter-code"
            placeholder="АСК000000001"
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplyFilters()
            }}
            className="h-8 pr-7"
          />
          {filterCode ? (
            <ClearInputButton
              onClick={() => {
                setFilterCode("")
                loadPayments({ code: "" })
              }}
              aria-label="Сбросить номер"
            />
          ) : null}
        </div>
        <div className="relative w-[350px]">
          <div className="relative">
            <Input
              id="filter-contractor"
              placeholder="Поставщик..."
              value={filterContractor}
              onChange={(e) => {
                const value = e.target.value
                setFilterContractor(value)
                // Открываем dropdown при вводе — показываем результаты фильтрации по частичному совпадению (как в Заказах поставщикам)
                setContractorComboboxOpen(value.trim().length > 0)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyFilters()
              }}
              className="h-8 pr-7"
            />
            {filterContractor ? (
              <ClearInputButton
                onClick={() => {
                  setFilterContractor("")
                  setContractorComboboxOpen(false)
                  loadPayments({ contractor: "" })
                }}
                aria-label="Сбросить контрагента"
              />
            ) : null}
          </div>
          {contractorComboboxOpen && filterContractor.trim().length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[250px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>Контрагенты не найдены</CommandEmpty>
                  <CommandGroup>
                    {uniqueContractors
                      .filter((contractor) =>
                        contractor.toLowerCase().includes(filterContractor.toLowerCase())
                      )
                      .map((contractor) => (
                        <CommandItem
                          key={contractor}
                          value={contractor}
                          onSelect={() => {
                            setFilterContractor(contractor)
                            setContractorComboboxOpen(false)
                            loadPayments({ contractor })
                          }}
                        >
                          {contractor}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>
        <div className="flex h-8 items-center gap-1">
          <Select value={filterYear || "all"} onValueChange={(value) => setFilterYear(value === "all" ? "" : value)}>
            <SelectTrigger size="sm" className="h-8 w-[100px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {uniqueYears.map((year) => (
                <SelectItem key={year} value={year}>
                  20{year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterYear ? (
            <ClearFilterButton onClick={() => setFilterYear("")} aria-label="Сбросить год" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-1">
          <Select value={filterOrganization || "all"} onValueChange={(value) => setFilterOrganization(value === "all" ? "" : value)}>
            <SelectTrigger size="sm" className="h-8 w-[200px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {uniqueOrganizations.map((org) => (
                <SelectItem key={org} value={org}>
                  {org}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterOrganization ? (
            <ClearFilterButton onClick={() => setFilterOrganization("")} aria-label="Сбросить организацию" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-1">
          <Select value={filterResponsible || "all"} onValueChange={(value) => setFilterResponsible(value === "all" ? "" : value)}>
            <SelectTrigger size="sm" className="h-8 w-[200px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {uniqueResponsibles.map((resp) => (
                <SelectItem key={resp} value={resp}>
                  {resp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterResponsible ? (
            <ClearFilterButton onClick={() => setFilterResponsible("")} aria-label="Сбросить ответственного" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-1">
          <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value === "all" ? "" : value)}>
            <SelectTrigger size="sm" className="h-8 w-[150px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterStatus ? (
            <ClearFilterButton onClick={() => setFilterStatus("")} aria-label="Сбросить статус" />
          ) : null}
        </div>
        <div className="flex h-8 items-center gap-2 justify-self-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-8"
          >
            Сбросить
          </Button>
        </div>
      </div>

      {/* Table: при загрузке — скелетон, иначе таблица и пагинация. ref для авто-высоты на десктопе. */}
      <div ref={tableContainerRef} className="flex flex-col gap-3">
      {loading ? (
        <div className="overflow-hidden rounded-lg border">
          <TableSkeleton columnCount={7} rowCount={10} />
        </div>
      ) : (
        <>
      <div className="overflow-hidden rounded-lg border">
        <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-[90px]">Дата</TableHead>
              <TableHead className="w-[120px]">Номер</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Организация</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead className="w-[120px]">Статус</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="!h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">Оплаты не найдены.</p>
                    <p className="mt-1 text-xs">Измените параметры фильтров или сбросьте их.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentPayments.map((payment, idx) => (
                <TableRow 
                  key={`${payment.Номер}-${idx}`}
                  className={cn(
                    "cursor-pointer transition-colors",
                    payment.Статус === "Оплачен" && "bg-green-50/30 dark:bg-green-950/30 hover:bg-green-100/40 dark:hover:bg-green-950/40",
                    payment.Статус === "Согласован" && "bg-blue-50/30 dark:bg-blue-950/30 hover:bg-blue-100/40 dark:hover:bg-blue-950/40",
                    payment.Статус === "Утвержден" && "bg-violet-50/30 dark:bg-violet-950/30 hover:bg-violet-100/40 dark:hover:bg-violet-950/40",
                    payment.Статус === "Срочно" && "bg-orange-50/30 dark:bg-orange-950/30 hover:bg-orange-100/40 dark:hover:bg-orange-950/40",
                    payment.Статус === "Отложен" && "bg-yellow-50/30 dark:bg-yellow-950/30 hover:bg-yellow-100/40 dark:hover:bg-yellow-950/40",
                    payment.Статус === "Подготовлен" && "bg-gray-50/30 dark:bg-gray-950/30 hover:bg-gray-100/40 dark:hover:bg-gray-950/40",
                    payment.Статус === "Отклонен" && "bg-red-50/30 dark:bg-red-950/30 hover:bg-red-100/40 dark:hover:bg-red-950/40",
                    !payment.Статус && "hover:bg-muted/50"
                  )}
                  onClick={() => openPaymentDetails(payment)}
                >
                  <TableCell className="text-sm">{formatDate(payment.Дата)}</TableCell>
                  <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(payment.Номер)
                        toast.success(`Номер ${payment.Номер} скопирован`)
                      }}
                      className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group"
                      title="Копировать номер"
                    >
                      <span style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                        {payment.Номер}
                      </span>
                      <IconCopy className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </TableCell>
                  <TableCell>
                    {payment.Счёт?.toLowerCase().includes("касса") && 
                     (payment.Контрагент === "Не указан" || !payment.Контрагент)
                      ? "Выдача средств из кассы"
                      : payment.Контрагент}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {payment.Организация}
                  </TableCell>
                  <TableCell className="text-sm">{payment.Ответственный}</TableCell>
                  <TableCell className="text-sm">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "px-1.5",
                        payment.Статус === "Оплачен" && "border-green-500 dark:border-green-400 text-muted-foreground",
                        payment.Статус === "Согласован" && "border-blue-500 dark:border-blue-400 text-muted-foreground",
                        payment.Статус === "Утвержден" && "border-violet-500 dark:border-violet-400 text-muted-foreground",
                        payment.Статус === "Срочно" && "border-orange-500 dark:border-orange-400 text-muted-foreground",
                        payment.Статус === "Отложен" && "border-yellow-500 dark:border-yellow-400 text-muted-foreground",
                        payment.Статус === "Подготовлен" && "border-gray-500 dark:border-gray-400 text-muted-foreground",
                        payment.Статус === "Отклонен" && "border-red-500 dark:border-red-400 text-muted-foreground",
                        !payment.Статус && "text-muted-foreground"
                      )}
                    >
                      {payment.Статус === "Оплачен" ? (
                        <IconCircleCheckFilled className="h-4 w-4 fill-green-500 dark:fill-green-400" />
                      ) : payment.Статус === "Согласован" ? (
                        <IconCircleCheckFilled className="h-4 w-4 fill-blue-500 dark:fill-blue-400" />
                      ) : payment.Статус === "Утвержден" ? (
                        <IconCircleCheckFilled className="h-4 w-4 fill-violet-500 dark:fill-violet-400" />
                      ) : payment.Статус === "Срочно" ? (
                        <IconBolt className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                      ) : payment.Статус === "Отложен" ? (
                        <IconAlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                      ) : payment.Статус === "Подготовлен" ? (
                        <IconLoader className="h-4 w-4" />
                      ) : payment.Статус === "Отклонен" ? (
                        <IconX className="h-4 w-4 text-red-500 dark:text-red-400" />
                      ) : null}
                      {payment.Статус}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSum(payment.Сумма)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls - bottom */}
      <div className="flex items-center justify-between">
        {/* Page size selector - left */}
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
              <SelectItem value="17">17</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
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
          <span className="text-sm text-muted-foreground">
            записей на странице
          </span>
        </div>

        {/* Navigation - right */}
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
            Страница {page} из {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || totalPages === 0}
          >
            Следующая
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
        </>
      )}
      </div>

      {/* Sheet — детали заявки или полноэкранный просмотр вложения */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { 
        if (!open) {
          setAttachmentPreview(null)
          // Поворот сохраняется в imageRotations, не сбрасываем
        }
        setSheetOpen(open)
      }}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 overflow-hidden !w-[50vw] !max-w-[50vw] border-l"
          showCloseButton={false}
        >
          {/* Режим просмотра вложения на весь Sheet */}
          {attachmentPreview ? (
            <>
              <SheetTitle className="sr-only">
                {attachmentPreview.attachments[attachmentPreview.index]
                  ? (attachmentPreview.attachments[attachmentPreview.index].ИмяФайла ||
                      attachmentPreview.attachments[attachmentPreview.index].Представление ||
                      "Просмотр вложения")
                  : "Просмотр вложения"}
              </SheetTitle>
              <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setAttachmentPreview(null)
                    setPdfZoom(1.0)
                  }}
                >
                  <IconArrowLeft className="h-4 w-4" />
                  К заявке
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={attachmentPreview.index <= 0}
                    onClick={() => {
                      setAttachmentPreview((p) =>
                        p && p.index > 0 ? { ...p, index: p.index - 1 } : p
                      )
                      setPdfZoom(1.0)
                    }}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[4rem] text-center tabular-nums">
                    {attachmentPreview.index + 1} / {attachmentPreview.attachments.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={attachmentPreview.index >= attachmentPreview.attachments.length - 1}
                    onClick={() => {
                      setAttachmentPreview((p) =>
                        p && p.index < p.attachments.length - 1
                          ? { ...p, index: p.index + 1 }
                          : p
                      )
                      setPdfZoom(1.0)
                    }}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  {(() => {
                    const att = attachmentPreview.attachments[attachmentPreview.index]
                    const name = att?.ИмяФайла || att?.Представление || "Файл"
                    const kind = getFilePreviewKind(name)
                    
                    // Для PDF не показываем кнопки управления - они есть в нативном viewer браузера
                    if (kind === "pdf") {
                      return null
                    }
                    
                    if (kind === "image") {
                      const attachmentId = att?.ИдентификаторХранилища || `index-${attachmentPreview.index}`
                      const currentRotation = imageRotations[attachmentId] || 0
                      return (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const newRotation = (currentRotation - 90) % 360
                              setImageRotations((prev) => ({
                                ...prev,
                                [attachmentId]: newRotation,
                              }))
                            }}
                            title="Повернуть против часовой стрелки"
                          >
                            <IconRotate2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const newRotation = (currentRotation + 90) % 360
                              setImageRotations((prev) => ({
                                ...prev,
                                [attachmentId]: newRotation,
                              }))
                            }}
                            title="Повернуть по часовой стрелке"
                          >
                            <IconRotateClockwise2 className="h-4 w-4" />
                          </Button>
                        </>
                      )
                    }
                    return null
                  })()}
                  {(() => {
                    const att = attachmentPreview.attachments[attachmentPreview.index]
                    const name = att?.ИмяФайла || att?.Представление || "Файл"
                    const kind = getFilePreviewKind(name)
                    
                    // Для PDF не показываем кнопки скачивания и печати - они есть в нативном viewer
                    if (kind === "pdf") {
                      return null
                    }
                    
                    return (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const att = attachmentPreview.attachments[attachmentPreview.index]
                            const name = att?.ИмяФайла || att?.Представление || "file"
                            const fileApiUrl = (id: string) =>
                              `/api/1c/payments/file/${encodeURIComponent(id)}`
                            const dataUrl = dataUrlFromAttachment(att)
                            const url = dataUrl ?? fileApiUrl(att?.ИдентификаторХранилища ?? "")
                            const link = document.createElement("a")
                            link.href = url
                            link.download = name
                            link.click()
                          }}
                          title="Скачать"
                        >
                          <IconDownload className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async () => {
                            const att = attachmentPreview.attachments[attachmentPreview.index]
                            const fileName = att?.ИмяФайла || att?.Представление || "Файл"
                            const fileApiUrl = (id: string) =>
                              `/api/1c/payments/file/${encodeURIComponent(id)}`
                            const dataUrl = dataUrlFromAttachment(att)
                            const url = dataUrl ?? fileApiUrl(att?.ИдентификаторХранилища ?? "")
                            await printPdfDialog(url, fileName)
                          }}
                          title="Печать"
                        >
                          <IconPrinter className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  })()}
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden -mt-px">
                {(() => {
                  const att = attachmentPreview.attachments[attachmentPreview.index]
                  if (!att) return null
                  const name = att.ИмяФайла || att.Представление || "Файл"
                  const fileApiUrl = (id: string) =>
                    `/api/1c/payments/file/${encodeURIComponent(id)}`
                  const dataUrl = dataUrlFromAttachment(att)
                  const url = dataUrl ?? fileApiUrl(att.ИдентификаторХранилища ?? "")
                  const kind = getFilePreviewKind(name)
                  if (kind === "pdf") {
                    return (
                      <PdfViewer fileUrl={url} fileName={name} zoom={pdfZoom} className="flex-1 min-h-0" />
                    )
                  }
                  if (kind === "image") {
                    const attachmentId = att.ИдентификаторХранилища || `index-${attachmentPreview.index}`
                    const currentRotation = imageRotations[attachmentId] || 0
                    return (
                      <div className="flex-1 min-h-0 overflow-auto p-2 flex items-center justify-center bg-muted/10">
                        <img
                          src={url}
                          alt={name}
                          className="max-w-full max-h-full object-contain transition-transform duration-200"
                          style={{
                            transform: `rotate(${currentRotation}deg)`,
                          }}
                        />
                      </div>
                    )
                  }
                  if (kind === "office") {
                    return (
                      <OfficeViewer fileUrl={url} fileName={name} className="flex-1 min-h-0" />
                    )
                  }
                  return (
                    <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground text-sm">
                      Просмотр недоступен. Скачайте файл по ссылке в карточке заявки.
                    </div>
                  )
                })()}
              </div>
            </>
          ) : (
            <>
              {/* Шапка как у билета: крупный код + дата */}
              <SheetHeader className={cn(
                "shrink-0 px-6 pr-12 pt-6 pb-4 border-b",
                // Фон в зависимости от статуса - более яркие цвета
                (selectedPayment?.Статус === "Оплачен" || paymentDetails?.Статус === "Оплачен") && "bg-green-100 dark:bg-green-900/60",
                (selectedPayment?.Статус === "Согласован" || paymentDetails?.Статус === "Согласован") && "bg-blue-100 dark:bg-blue-900/60",
                (selectedPayment?.Статус === "Утвержден" || paymentDetails?.Статус === "Утвержден") && "bg-violet-100 dark:bg-violet-900/60",
                (selectedPayment?.Статус === "Срочно" || paymentDetails?.Статус === "Срочно") && "bg-orange-100 dark:bg-orange-900/60",
                (selectedPayment?.Статус === "Отложен" || paymentDetails?.Статус === "Отложен") && "bg-yellow-100 dark:bg-yellow-900/60",
                (selectedPayment?.Статус === "Подготовлен" || paymentDetails?.Статус === "Подготовлен") && "bg-gray-100 dark:bg-gray-800/60",
                (selectedPayment?.Статус === "Отклонен" || paymentDetails?.Статус === "Отклонен") && "bg-red-100 dark:bg-red-900/60",
                // Дефолтный фон, если статус неизвестен
                !(selectedPayment?.Статус || paymentDetails?.Статус) && "bg-muted/30"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-foreground">Заявка на оплату</span>
                  {selectedPayment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        navigator.clipboard.writeText(selectedPayment.Номер)
                        toast.success(`Номер ${selectedPayment.Номер} скопирован`)
                      }}
                      className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -ml-0.5 hover:bg-muted/50 transition-colors cursor-pointer group"
                      style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                      title="Копировать номер"
                    >
                      <span className="text-xl font-semibold text-foreground tabular-nums">{selectedPayment.Номер}</span>
                      <IconCopy className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  )}
                </div>
                <SheetDescription className="text-sm mt-1">
                  {formatDate(selectedPayment?.Дата)}
                </SheetDescription>
              </SheetHeader>

              {detailsLoading ? (
                <div className="flex flex-1 items-center justify-center py-16">
                  <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Загрузка...</span>
                </div>
              ) : paymentDetails ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="px-6 py-6 space-y-6">
                    {/* Карточка: контрагент, сумма, организация, ответственный, вид операции, счёт, статус — сетка */}
                    <Card className="py-4">
                      <CardContent className="pt-0 px-6 pb-0">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Контрагент</p>
                            <p className="text-sm font-medium break-words">
                              {paymentDetails.Счёт?.toLowerCase().includes("касса") && 
                               (paymentDetails.Контрагент === "Не указан" || !paymentDetails.Контрагент)
                                ? "Выдача средств из кассы"
                                : paymentDetails.Контрагент}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Сумма</p>
                            <p className="text-lg font-semibold tabular-nums whitespace-nowrap">{formatSum(paymentDetails.Сумма)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Организация</p>
                            <p className="text-sm break-words">{paymentDetails.Организация}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ответственный</p>
                            <p className="text-sm break-words">{paymentDetails.Ответственный}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Вид операции</p>
                            <p className="text-sm break-words">{paymentDetails.ВидОперации}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Счёт</p>
                            <p className="text-sm break-words">{paymentDetails.Счёт}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Статус</p>
                            <div>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "px-1.5",
                                  paymentDetails.Статус === "Оплачен" && "border-green-500 dark:border-green-400 text-muted-foreground",
                                  paymentDetails.Статус === "Согласован" && "border-blue-500 dark:border-blue-400 text-muted-foreground",
                                  paymentDetails.Статус === "Утвержден" && "border-violet-500 dark:border-violet-400 text-muted-foreground",
                                  paymentDetails.Статус === "Срочно" && "border-orange-500 dark:border-orange-400 text-muted-foreground",
                                  paymentDetails.Статус === "Отложен" && "border-yellow-500 dark:border-yellow-400 text-muted-foreground",
                                  paymentDetails.Статус === "Подготовлен" && "border-gray-500 dark:border-gray-400 text-muted-foreground",
                                  paymentDetails.Статус === "Отклонен" && "border-red-500 dark:border-red-400 text-muted-foreground",
                                )}
                              >
                                {paymentDetails.Статус === "Оплачен" ? (
                                  <IconCircleCheckFilled className="h-4 w-4 fill-green-500 dark:fill-green-400" />
                                ) : paymentDetails.Статус === "Согласован" ? (
                                  <IconCircleCheckFilled className="h-4 w-4 fill-blue-500 dark:fill-blue-400" />
                                ) : paymentDetails.Статус === "Утвержден" ? (
                                  <IconCircleCheckFilled className="h-4 w-4 fill-violet-500 dark:fill-violet-400" />
                                ) : paymentDetails.Статус === "Срочно" ? (
                                  <IconBolt className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                                ) : paymentDetails.Статус === "Отложен" ? (
                                  <IconAlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                                ) : paymentDetails.Статус === "Подготовлен" ? (
                                  <IconLoader className="h-4 w-4" />
                                ) : paymentDetails.Статус === "Отклонен" ? (
                                  <IconX className="h-4 w-4 text-red-500 dark:text-red-400" />
                                ) : null}
                                {paymentDetails.Статус}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Комментарий внутри той же Card */}
                        {paymentDetails.Комментарий?.trim() && (
                          <>
                            <Separator className="my-4" />
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Комментарий</p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words bg-yellow-200 px-2 py-1.5 rounded-sm inline-block">{paymentDetails.Комментарий}</p>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Расшифровка платежа (табличная часть) */}
                    {paymentDetails.РасшифровкаПлатежа && paymentDetails.РасшифровкаПлатежа.length > 0 && (
                      <PaymentLinesSection title="Расшифровка платежа" items={paymentDetails.РасшифровкаПлатежа} />
                    )}

                    {/* Вложения: при full=1 используем ФайлBase64 из ответа (без вызова API файла); иначе — ссылка на API */}
                    {paymentDetails.ДопИнформация && paymentDetails.ДопИнформация.length > 0 && (() => {
                      const attachments = paymentDetails.ДопИнформация.filter(
                        (a: SupplierOrderAttachment) =>
                          (a.ЕстьВложение && a.ИдентификаторХранилища) || !!a.ФайлBase64
                      ) as SupplierOrderAttachment[]
                      if (attachments.length === 0) return null
                      const fileApiUrl = (id: string) => `/api/1c/payments/file/${encodeURIComponent(id)}`
                      return (
                        <Card className="overflow-hidden gap-1.5 py-4">
                          <CardHeader className="py-0 pb-1.5 px-6">
                            <CardTitle className="text-xs font-medium tracking-tight text-muted-foreground uppercase">
                              Вложения
                              <span className="ml-2 font-normal normal-case text-foreground">{attachments.length}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 px-6 pb-0">
                            <ul className="space-y-2">
                              {attachments.map((att, idx) => {
                                const name = att.ИмяФайла || att.Представление || "Файл"
                                const id = att.ИдентификаторХранилища ?? `att-${idx}`
                                const dataUrl = dataUrlFromAttachment(att)
                                const href = dataUrl ?? fileApiUrl(id)
                                const kind = getFilePreviewKind(name)
                                return (
                                  <li key={id} className="flex items-center gap-2 flex-wrap">
                                    <IconFile className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={dataUrl ? name : undefined}
                                      className="text-sm text-primary hover:underline break-all"
                                    >
                                      {name}
                                    </a>
                                    {kind !== "other" && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1"
                                        onClick={() =>
                                          setAttachmentPreview({ attachments, index: idx })
                                        }
                                      >
                                        <IconEye className="h-3.5 w-3.5" />
                                        Просмотр
                                      </Button>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          </CardContent>
                        </Card>
                      )
                    })()}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
