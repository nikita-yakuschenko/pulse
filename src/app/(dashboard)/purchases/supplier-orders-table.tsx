"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { formatMaterialQty, formatUnit } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { IconLoader, IconChevronLeft, IconChevronRight, IconSearch, IconFilter, IconX, IconCheck, IconSelector, IconCopy, IconFile, IconEye, IconArrowLeft, IconPrinter, IconZoomIn, IconZoomOut, IconDownload, IconRotateClockwise2, IconRotate2 } from "@tabler/icons-react"
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
import { cn } from "@/lib/utils"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useTableAutoPageSize } from "@/hooks/use-table-auto-page-size"
import type { SupplierOrder, SupplierOrderAttachment } from "@/types/1c"
import { OfficeViewer } from "@/components/office-viewer"

// pdfjs-dist падает на сервере (Object.defineProperty) — подключаем только на клиенте
const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => ({ default: m.PdfViewer })),
  { ssr: false }
)

// Строка товара/услуги/материала в полном ответе заказа
interface OrderLineItem {
  НомерСтроки?: string
  Номенклатура: string
  Код?: string
  ХарактеристикаНоменклатуры?: string
  ЕдиницаИзмерения?: string
  ЕдиницаИзмеренияМест?: string
  Количество: number
  КоличествоМест?: number
  Коэффициент?: number
  Цена: number
  Сумма: number
  СтавкаНДС?: string
  СуммаНДС?: number
  ПлановаяСебестоимость?: number
}

// Расширенный тип для полного ответа по заказу (full=1)
interface SupplierOrderDetails extends SupplierOrder {
  Товары?: OrderLineItem[]
  Услуги?: OrderLineItem[]
  Оборудование?: OrderLineItem[]
  Материалы?: OrderLineItem[]
  ВозвратнаяТара?: OrderLineItem[]
  Комментарий?: string
  СпособДоставки?: string
  АдресДоставки?: string
}

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
function extractShortYear(dateStr: string): string {
  const [datePart] = dateStr.split(" ")
  const [, , year] = datePart.split(".")
  return year.slice(-2)
}

/** Кнопка сброса одного параметра (внутри input-полей) */
function ClearInputButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

/** Кнопка сброса одного параметра (рядом с select/checkbox) */
function ClearFilterButton({ onClick, "aria-label": ariaLabel = "Сбросить" }: { onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <IconX className="h-3.5 w-3.5" />
    </button>
  )
}

/** Формат суммы: только число, пробелы как разделители тысяч, всегда два знака после запятой (верстка не едет). */
const formatSum = (n: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

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

/** Открывает PDF в новой вкладке с заданным заголовком (имя файла). */
function openPdfWithTitle(pdfUrl: string, fileName: string): void {
  const title = escapeHtml(fileName)
  const src = pdfUrl.replace(/"/g, "&quot;")
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style></head><body><embed src="${src}" type="application/pdf" style="position:absolute;left:0;top:0;width:100%;height:100%;border:none"/></body></html>`
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, "_blank")
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
}

/** Секция строк заказа: один шрифт (наследуемый), tabular-nums только для выравнивания цифр, заголовок вплотную к таблице */
function OrderLinesSection({ title, items }: { title: string; items: OrderLineItem[] }) {
  const unit = (item: OrderLineItem) => item.ЕдиницаИзмерения?.trim() || "шт"
  const gridCols = "24px minmax(140px, 1fr) 52px 36px 125px 125px"
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
          <div className="min-w-[540px]">
            <div
              className="grid gap-x-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b font-medium"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span>№</span>
              <span>Номенклатура</span>
              <span className="text-right">Кол-во</span>
              <span className="text-right">Ед.</span>
              <span className="text-right">Цена</span>
              <span className="text-right">Сумма</span>
            </div>
            {items.map((item, i) => (
              <div
                key={item.НомерСтроки ?? i}
                className={cn(
                  "grid gap-x-3 px-4 text-sm",
                  item.Код ? "pt-7 pb-3" : "py-4",
                  i < items.length - 1 && "border-b border-border/50"
                )}
                style={{ gridTemplateColumns: gridCols, alignItems: "baseline" }}
              >
                <span className="text-muted-foreground tabular-nums">{item.НомерСтроки ?? i + 1}</span>
                <div className="min-w-0 break-words relative">
                  {item.Код ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.Код!)
                        toast.success(`Код ${item.Код} скопирован`)
                      }}
                      className="absolute -top-5 left-0 inline-flex items-center gap-1 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group"
                      title="Копировать код"
                    >
                      <span className="text-xs uppercase tracking-wide text-muted-foreground" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                        КОД: {item.Код}
                      </span>
                      <IconCopy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ) : null}
                  <div className="font-medium">{item.Номенклатура}</div>
                  {item.ХарактеристикаНоменклатуры?.trim() ? (
                    <div className="text-xs text-muted-foreground">{item.ХарактеристикаНоменклатуры}</div>
                  ) : null}
                </div>
                <span className="text-right tabular-nums shrink-0">{formatMaterialQty(item.Количество)}</span>
                <span className="text-right text-muted-foreground text-xs shrink-0">{formatUnit(unit(item))}</span>
                <span className="text-right tabular-nums text-muted-foreground text-xs whitespace-nowrap shrink-0">{formatSum(item.Цена)}</span>
                <span className="text-right tabular-nums font-semibold whitespace-nowrap shrink-0">{formatSum(item.Сумма)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SupplierOrdersTable() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200]
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("supplier-orders-page-size")
      const n = saved ? Number(saved) : 17
      return n >= 1 && n <= 500 ? n : 17
    }
    return 17
  })
  // Отдельный state для селекта: при выборе «Своё» должен показываться «custom», иначе Radix не переключает
  const [pageSizeSelectValue, setPageSizeSelectValue] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("supplier-orders-page-size")
      const n = saved ? Number(saved) : 17
      return PAGE_SIZE_PRESETS.includes(n) ? String(n) : "custom"
    }
    return "17"
  })

  const setPageSizeAndSave = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(500, n))
    setPageSize(clamped)
    setPage(1)
    setPageSizeSelectValue(PAGE_SIZE_PRESETS.includes(clamped) ? String(clamped) : "custom")
    localStorage.setItem("supplier-orders-page-size", String(clamped))
  }, [])

  // Фильтры для API (серверная фильтрация)
  const [filterCode, setFilterCode] = useState("")
  const [filterContractor, setFilterContractor] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterFull, setFilterFull] = useState(false)

  // Фильтры для клиентской фильтрации
  const [filterOrganization, setFilterOrganization] = useState("")
  const [filterResponsible, setFilterResponsible] = useState("")

  // Состояние для combobox контрагентов
  const [contractorComboboxOpen, setContractorComboboxOpen] = useState(false)

  // Состояние для Sheet с подробной информацией о заказе
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null)
  const [orderDetails, setOrderDetails] = useState<SupplierOrderDetails | null>(null)
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

  // Накопленные опции для dropdown-ов (объединение по всем загрузкам), чтобы после применения фильтров можно было выбрать другой год/организацию/ответственного
  const optionsAccumulator = useRef({ 
    years: new Set<string>(), 
    orgs: new Set<string>(), 
    resps: new Set<string>(), 
    contractors: new Set<string>() 
  })

  type OrdersFilters = {
    code: string
    contractor: string
    year: string
    full: boolean
  }

  // Загрузка данных
  const loadOrders = useCallback(async (overrides?: Partial<OrdersFilters>) => {
    setLoading(true)
    try {
      const code = overrides?.code ?? filterCode
      const contractor = overrides?.contractor ?? filterContractor
      const year = overrides?.year ?? filterYear
      const full = overrides?.full ?? filterFull

      // Формируем URL с параметрами фильтрации
      const params = new URLSearchParams()
      if (code.trim()) params.set("code", code.trim())
      if (contractor.trim()) params.set("contractor", contractor.trim())
      if (year) params.set("year", year)
      if (full) params.set("full", "1")

      const url = `/api/1c/supplier-orders${params.toString() ? `?${params}` : ""}`
      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Не удалось загрузить заказы")
        return
      }

      // Сортируем по дате: новые вверху
      const sorted = (data.data || []).sort((a: SupplierOrder, b: SupplierOrder) => {
        const dateA = parseDate(a.Дата)
        const dateB = parseDate(b.Дата)
        return dateB.getTime() - dateA.getTime()
      })

      setOrders(sorted)
      setPage(1)
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error)
      const isNetworkError =
        error instanceof TypeError && (error.message === "Failed to fetch" || (error as Error).message?.includes("fetch"))
      toast.error(isNetworkError ? "Нет связи с сервером. Проверьте интернет или отключите расширения браузера." : "Ошибка загрузки данных")
    } finally {
      setLoading(false)
    }
  }, [filterCode, filterContractor, filterYear, filterFull])

  // Первоначальная загрузка - сначала загружаем ВСЕ данные для сбора всех доступных годов
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true)
      try {
        // Загружаем все данные без фильтров для сбора всех доступных годов, организаций, ответственных, контрагентов
        const res = await fetch('/api/1c/supplier-orders')
        const data = await res.json()
        
        if (res.ok && data.data) {
          // Собираем все уникальные значения для dropdown-ов
          data.data.forEach((order: SupplierOrder) => {
            optionsAccumulator.current.years.add(extractShortYear(order.Дата))
            if (order.Организация) optionsAccumulator.current.orgs.add(order.Организация)
            if (order.Ответственный) optionsAccumulator.current.resps.add(order.Ответственный)
            if (order.Контрагент) optionsAccumulator.current.contractors.add(order.Контрагент)
          })
        }
        
        // Теперь загружаем с дефолтным фильтром года
        await loadOrders()
        // Отмечаем что первоначальная загрузка завершена
        isInitialLoadDone.current = true
      } catch (error) {
        console.error("Ошибка первоначальной загрузки:", error)
        setLoading(false)
        const isNetworkError =
          error instanceof TypeError && (error.message === "Failed to fetch" || (error as Error).message?.includes("fetch"))
        toast.error(isNetworkError ? "Нет связи с сервером. Проверьте интернет или отключите расширения браузера." : "Ошибка загрузки данных")
      }
    }
    loadInitial()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Автоматическая загрузка при изменении серверных фильтров (Год, Полная информация)
  useEffect(() => {
    // Пропускаем первую загрузку (она выполняется в useEffect выше)
    if (!isInitialLoadDone.current) return
    loadOrders()
  }, [filterYear, filterFull]) // eslint-disable-line react-hooks/exhaustive-deps

  // Текстовые фильтры применяются вручную (Enter или кнопка "Применить")

  // При каждой загрузке дополняем накопленные опции (чтобы в выпадающих списках всегда были все когда-либо виденные значения)
  useEffect(() => {
    orders.forEach((order) => {
      optionsAccumulator.current.years.add(extractShortYear(order.Дата))
      if (order.Организация) optionsAccumulator.current.orgs.add(order.Организация)
      if (order.Ответственный) optionsAccumulator.current.resps.add(order.Ответственный)
      if (order.Контрагент) optionsAccumulator.current.contractors.add(order.Контрагент)
    })
  }, [orders])

  // Опции для dropdown-ов — из накопленного набора
  const uniqueYears = useMemo(() => {
    return Array.from(optionsAccumulator.current.years).sort((a, b) => Number(b) - Number(a))
  }, [orders])
  const uniqueOrganizations = useMemo(() => {
    return Array.from(optionsAccumulator.current.orgs).sort()
  }, [orders])
  const uniqueResponsibles = useMemo(() => {
    return Array.from(optionsAccumulator.current.resps).sort()
  }, [orders])
  const uniqueContractors = useMemo(() => {
    return Array.from(optionsAccumulator.current.contractors).sort()
  }, [orders])

  // Открытие Sheet с подробной информацией о заказе
  const openOrderDetails = useCallback(async (order: SupplierOrder) => {
    setSelectedOrder(order)
    setSheetOpen(true)
    setDetailsLoading(true)
    setOrderDetails(null)

    try {
      // Загружаем подробную информацию с параметром full=1
      const params = new URLSearchParams()
      params.set("code", order.Номер)
      params.set("contractor", order.Контрагент)
      // Извлекаем год из даты
      const [datePart] = order.Дата.split(" ")
      const [, , year] = datePart.split(".")
      params.set("year", year.slice(-2))
      params.set("full", "1")

      const res = await fetch(`/api/1c/supplier-orders?${params}`)
      const data = await res.json()

      if (res.ok && data.data && data.data.length > 0) {
        setOrderDetails(data.data[0])
      } else {
        // Если не удалось загрузить подробности, используем базовую информацию
        setOrderDetails(order as SupplierOrderDetails)
      }
    } catch (error) {
      console.error("Ошибка загрузки подробностей заказа:", error)
      setOrderDetails(order as SupplierOrderDetails)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  const startIdx = (page - 1) * effectivePageSize
  const endIdx = startIdx + effectivePageSize
  
  // Клиентская фильтрация: организация, ответственный и поисковый запрос
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Фильтр по организации
      if (filterOrganization && order.Организация !== filterOrganization) {
        return false
      }
      // Фильтр по ответственному
      if (filterResponsible && order.Ответственный !== filterResponsible) {
        return false
      }
      // Поисковый запрос
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          order.Номер.toLowerCase().includes(query) ||
          order.Контрагент.toLowerCase().includes(query) ||
          order.Организация.toLowerCase().includes(query) ||
          order.Ответственный.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [orders, filterOrganization, filterResponsible, searchQuery])
  
  const totalFilteredPages = Math.ceil(filteredOrders.length / effectivePageSize)
  const currentOrders = filteredOrders.slice(startIdx, endIdx)
  
  // На мобильной ширине сбрасываем «Авто», чтобы не показывать несуществующую опцию
  useEffect(() => {
    if (autoPageSize === 0 && pageSizeSelectValue === "auto") {
      setPageSizeSelectValue("17")
    }
  }, [autoPageSize, pageSizeSelectValue])

  // Сбрасываем страницу на 1 при изменении фильтров
  useEffect(() => {
    setPage(1)
  }, [searchQuery, filterOrganization, filterResponsible])

  // Применение серверных фильтров
  const handleApplyFilters = () => {
    loadOrders()
  }

  // Сброс всех фильтров — очищаем состояние и перезагружаем данные без серверных фильтров
  const handleResetFilters = useCallback(() => {
    setFilterCode("")
    setFilterContractor("")
    setFilterYear("")
    setFilterFull(false)
    setFilterOrganization("")
    setFilterResponsible("")
    setSearchQuery("")
    loadOrders({ code: "", contractor: "", year: "", full: false })
  }, [loadOrders])

  return (
    <div className="flex flex-col gap-3">
      {/* Filters - inline row */}
      <div
        className="grid min-h-[5rem] grid-cols-[auto_auto_auto_auto_auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-3"
        style={{ gridTemplateRows: "auto 32px" }}
      >
        {/* Строка 1: все метки. Строка 2: все контролы (высота 32px) */}
        <Label htmlFor="filter-code" className="text-xs text-muted-foreground">
          Номер
        </Label>
        <Label htmlFor="filter-contractor" className="text-xs text-muted-foreground">
          Контрагент
        </Label>
        <Label className="text-xs text-muted-foreground">Год</Label>
        <Label className="text-xs text-muted-foreground">Организация</Label>
        <Label className="text-xs text-muted-foreground">Ответственный</Label>
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
                loadOrders({ code: "" })
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
                // Открываем dropdown при вводе — показываем результаты фильтрации по частичному совпадению
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
                  loadOrders({ contractor: "" })
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
                            loadOrders({ contractor })
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
          <Select 
            value={filterYear || "__all__"} 
            onValueChange={(v) => setFilterYear(v === "__all__" ? "" : v)}
          >
            <SelectTrigger size="sm" className="h-8 w-[90px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
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
          <Select 
            value={filterOrganization || "__all__"} 
            onValueChange={(v) => setFilterOrganization(v === "__all__" ? "" : v)}
          >
<SelectTrigger size="sm" className="h-8 w-[160px]">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все</SelectItem>
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
          <Select 
            value={filterResponsible || "__all__"} 
            onValueChange={(v) => setFilterResponsible(v === "__all__" ? "" : v)}
          >
<SelectTrigger size="sm" className="h-8 w-[160px]">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все</SelectItem>
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
        <div className="flex h-8 items-center gap-2">
          <Checkbox
            id="filter-full"
            checked={filterFull}
            onCheckedChange={(checked) => setFilterFull(checked === true)}
          />
          <span className="text-sm">Полная информация</span>
          {filterFull ? (
            <ClearFilterButton onClick={() => setFilterFull(false)} aria-label="Сбросить полную информацию" />
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

      {/* Search */}
      {/* Закомментировано: общий поиск не нужен, так как есть подробные фильтры по номеру, контрагенту, году, организации и ответственному */}
      {/* <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Быстрый поиск по всем полям..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div> */}

      {/* Table: при загрузке — скелетон, иначе таблица и пагинация. ref для авто-высоты на десктопе. */}
      <div ref={tableContainerRef} className="flex flex-col gap-3">
      {loading ? (
        <div className="overflow-hidden rounded-lg border">
          <TableSkeleton columnCount={6} rowCount={10} />
        </div>
      ) : (
        <>
      <div className="overflow-hidden rounded-lg border">
        <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-[140px]">Дата</TableHead>
              <TableHead className="w-[120px]">Номер</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Организация</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="!h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">Заказы поставщикам не найдены.</p>
                    <p className="mt-1 text-xs">Измените параметры фильтров или сбросьте их.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentOrders.map((order, idx) => (
                <TableRow 
                  key={`${order.Номер}-${idx}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openOrderDetails(order)}
                >
                  <TableCell className="text-sm">{order.Дата}</TableCell>
                  <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(order.Номер)
                        toast.success(`Номер ${order.Номер} скопирован`)
                      }}
                      className="inline-flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted transition-colors cursor-pointer group"
                      title="Копировать номер"
                    >
                      <span style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                        {order.Номер}
                      </span>
                      <IconCopy className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </TableCell>
                  <TableCell>{order.Контрагент}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.Организация}
                  </TableCell>
                  <TableCell className="text-sm">{order.Ответственный}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSum(order.Сумма)}
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
            Страница {page} из {totalFilteredPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalFilteredPages, p + 1))}
            disabled={page === totalFilteredPages || totalFilteredPages === 0}
          >
            Следующая
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
        </>
      )}
      </div>

      {/* Sheet — детали заказа или полноэкранный просмотр вложения */}
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
                  К заказу
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
                      // Поворот сохраняется в imageRotations, не сбрасываем
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
                      // Поворот сохраняется в imageRotations, не сбрасываем
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
                              `/api/1c/supplier-orders/file/${encodeURIComponent(id)}`
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
                              `/api/1c/supplier-orders/file/${encodeURIComponent(id)}`
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
                    `/api/1c/supplier-orders/file/${encodeURIComponent(id)}`
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
                      Просмотр недоступен. Скачайте файл по ссылке в карточке заказа.
                    </div>
                  )
                })()}
              </div>
            </>
          ) : (
            <>
              {/* Шапка как у билета: крупный код + дата */}
              <SheetHeader className="shrink-0 px-6 pr-12 pt-6 pb-4 border-b bg-muted/30">
                <div className="flex items-baseline justify-between gap-4">
                  <SheetTitle className="text-base font-semibold tracking-tight text-muted-foreground">
                    Заказ поставщику
                  </SheetTitle>
                  {selectedOrder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        navigator.clipboard.writeText(selectedOrder.Номер)
                        toast.success(`Номер ${selectedOrder.Номер} скопирован`)
                      }}
                      className="inline-flex items-center gap-1.5 rounded px-1 -mr-1 hover:bg-muted transition-colors cursor-pointer group text-xl font-semibold tabular-nums tracking-tight"
                      style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                      title="Копировать номер"
                    >
                      {selectedOrder.Номер}
                      <IconCopy className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  )}
                </div>
                <SheetDescription className="text-sm mt-1">
                  {selectedOrder?.Дата}
                </SheetDescription>
              </SheetHeader>

          {detailsLoading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Загрузка...</span>
            </div>
          ) : orderDetails ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-6">
                {/* Карточка: контрагент, сумма, организация, ответственный — сетка 2×2, подписи как верхняя граница секции, без лишнего отступа */}
                <Card className="py-4">
                  <CardContent className="pt-0 px-6 pb-0">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Контрагент</p>
                        <p className="text-sm font-medium break-words">{orderDetails.Контрагент}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Сумма</p>
                        <p className="text-lg font-semibold tabular-nums whitespace-nowrap">{formatSum(orderDetails.Сумма)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Организация</p>
                        <p className="text-sm break-words">{orderDetails.Организация}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ответственный</p>
                        <p className="text-sm break-words">{orderDetails.Ответственный}</p>
                      </div>
                    </div>

                    {/* Комментарий внутри той же Card */}
                    {orderDetails.Комментарий?.trim() && (
                      <>
                        <Separator className="my-4" />
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Комментарий</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words bg-yellow-200 px-2 py-1.5 rounded-sm inline-block">{orderDetails.Комментарий}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Доставка — только если есть */}
                {(orderDetails.СпособДоставки || orderDetails.АдресДоставки) && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-4">
                      {orderDetails.СпособДоставки && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Способ доставки</p>
                          <p className="text-sm">{orderDetails.СпособДоставки}</p>
                        </div>
                      )}
                      {orderDetails.АдресДоставки && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Адрес доставки</p>
                          <p className="text-sm">{orderDetails.АдресДоставки}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Секции товаров/услуг и т.д. */}
                {orderDetails.Товары && orderDetails.Товары.length > 0 && (
                  <OrderLinesSection title="Товары" items={orderDetails.Товары} />
                )}
                {orderDetails.Услуги && orderDetails.Услуги.length > 0 && (
                  <OrderLinesSection title="Услуги" items={orderDetails.Услуги} />
                )}
                {orderDetails.Оборудование && orderDetails.Оборудование.length > 0 && (
                  <OrderLinesSection title="Оборудование" items={orderDetails.Оборудование} />
                )}
                {orderDetails.Материалы && orderDetails.Материалы.length > 0 && (
                  <OrderLinesSection title="Материалы" items={orderDetails.Материалы} />
                )}
                {orderDetails.ВозвратнаяТара && orderDetails.ВозвратнаяТара.length > 0 && (
                  <OrderLinesSection title="Возвратная тара" items={orderDetails.ВозвратнаяТара} />
                )}

                {/* Вложения: при full=1 используем ФайлBase64 из ответа (без вызова API файла); иначе — ссылка на API */}
                {orderDetails.ДопИнформация && orderDetails.ДопИнформация.length > 0 && (() => {
                  const attachments = orderDetails.ДопИнформация.filter(
                    (a: SupplierOrderAttachment) =>
                      (a.ЕстьВложение && a.ИдентификаторХранилища) || !!a.ФайлBase64
                  ) as SupplierOrderAttachment[]
                  if (attachments.length === 0) return null
                  const fileApiUrl = (id: string) => `/api/1c/supplier-orders/file/${encodeURIComponent(id)}`
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
