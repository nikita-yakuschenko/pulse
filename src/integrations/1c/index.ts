/**
 * Интеграция с 1С
 * Модули: спецификации, остатки, заказы поставщикам, ЗРДС (платежи)
 */

import { createOneCClient, type OneCCredentials, type OneCEnvironment } from "@/lib/1c-client"

/**
 * Параметры фильтрации заказов поставщикам
 */
export interface SordersFilters {
  code?: string      // Номер заказа (поиск по вхождению)
  contractor?: string // Контрагент (поиск по вхождению)
  year?: string      // Год в коротком формате (24, 25, 26)
  full?: boolean     // Полная информация с табличной частью
}

/**
 * Строит endpoint для запроса заказов поставщикам на основе фильтров.
 * 
 * Доступные комбинации в API 1С:
 * 1. list                                      → нет фильтров
 * 2. code/{x}                                  → code
 * 3. code/{x}/full/{z}                         → code + full
 * 4. code/{x}/year/{y}                         → code + year
 * 5. code/{x}/year/{y}/full/{z}                → code + year + full
 * 6. contractor/{x}                            → contractor
 * 7. contractor/{x}/year/{y}                   → contractor + year
 * 8. contractor/{x}/year/{y}/full/{z}          → contractor + year + full
 * 9. code/{x}/contractor/{c}/year/{y}/full/{z} → code + contractor + year + full
 * 10. year/{y}                                 → year
 * 
 * Порядок сегментов фиксирован: code → contractor → year → full
 */
export function buildSordersEndpoint(filters: SordersFilters): string {
  const { code, contractor, year, full } = filters
  const hasCode = !!code?.trim()
  const hasContractor = !!contractor?.trim()
  const hasYear = !!year?.trim()
  const hasFull = !!full

  // Кодируем спецсимволы для IIS/1C, где "+" и "-" могут ломать путь.
  const encodePath = (value: string): string => {
    const normalized = value
      .replaceAll("+", "_plus_")
      .replaceAll("-", "_dash_")
    return encodeURIComponent(normalized)
  }

  // Комбинация: code + contractor + year + full (единственная где оба вместе)
  if (hasCode && hasContractor && hasYear && hasFull) {
    return `sorders/get/code/${encodePath(code!)}/contractor/${encodePath(contractor!)}/year/${encodePath(year!)}/full/1`
  }

  // code + year + full
  if (hasCode && hasYear && hasFull) {
    return `sorders/get/code/${encodePath(code!)}/year/${encodePath(year!)}/full/1`
  }

  // code + year
  if (hasCode && hasYear) {
    return `sorders/get/code/${encodePath(code!)}/year/${encodePath(year!)}`
  }

  // code + full
  if (hasCode && hasFull) {
    return `sorders/get/code/${encodePath(code!)}/full/1`
  }

  // code only
  if (hasCode) {
    return `sorders/get/code/${encodePath(code!)}`
  }

  // contractor + year + full
  if (hasContractor && hasYear && hasFull) {
    return `sorders/get/contractor/${encodePath(contractor!)}/year/${encodePath(year!)}/full/1`
  }

  // contractor + year
  if (hasContractor && hasYear) {
    return `sorders/get/contractor/${encodePath(contractor!)}/year/${encodePath(year!)}`
  }

  // contractor only
  if (hasContractor) {
    return `sorders/get/contractor/${encodePath(contractor!)}`
  }

  // year only
  if (hasYear) {
    return `sorders/get/year/${encodePath(year!)}`
  }

  // Нет фильтров — полный список
  return "sorders/get/list"
}

/**
 * Получает настройки 1С из метаданных пользователя
 */
export async function getOneCCredentials(userMetadata: Record<string, unknown>): Promise<OneCCredentials | null> {
  const integrations = userMetadata.integrations as Record<string, unknown> | undefined
  const oneC = integrations?.["1c"] as { environment: string; username: string; password: string; enabled: boolean } | undefined
  
  if (!oneC || !oneC.enabled) {
    return null
  }
  
  return {
    environment: oneC.environment as OneCEnvironment,
    username: oneC.username,
    password: oneC.password,
  }
}

/**
 * Получение списка заказов поставщикам с фильтрацией
 */
export async function getSupplierOrders(userMetadata: Record<string, unknown>, filters?: SordersFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters || {}
  const endpoint = buildSordersEndpoint(f)
  try {
    return await client.get(endpoint)
  } catch (error) {
    const hasCode = !!f.code?.trim()
    const hasYear = !!f.year?.trim()
    const hasFull = !!f.full
    const hasContractor = !!f.contractor?.trim()

    // Fallback 1: полный запрос с contractor дал 404 — пробуем без contractor (code + year + full)
    if (hasCode && hasYear && hasFull && hasContractor) {
      const fallbackEndpoint = buildSordersEndpoint({
        code: f.code,
        year: f.year,
        full: true,
      })
      return client.get(fallbackEndpoint)
    }

    // Fallback 2: запрос с contractor (без full) дал 404 — 1С может не иметь маршрута "только contractor"
    // или путь ломается из-за точки/длины. Запрашиваем list (или year) и фильтруем по контрагенту на клиенте.
    if (hasContractor && !hasFull) {
      const listEndpoint = hasYear
        ? buildSordersEndpoint({ year: f.year })
        : "sorders/get/list"
      const list = (await client.get(listEndpoint)) as Array<{ Контрагент?: string; [key: string]: unknown }>
      if (Array.isArray(list)) {
        const needle = (f.contractor ?? "").toLowerCase()
        const filtered = list.filter(
          (row) => (row.Контрагент ?? "").toLowerCase().includes(needle)
        )
        return filtered
      }
    }

    throw error
  }
}

/**
 * Параметры фильтрации спецификаций
 * API 1С: specifications/get/list | get/name/{name} | get/code/{code} | get/material/{material} | get/year/{year} | get/year/{year}/month/{month}
 * Для name, code, material можно добавить /full/1 для детальной информации (все материалы)
 */
export interface SpecificationsFilters {
  name?: string    // Поиск по вхождению в имени
  code?: string    // Поиск по вхождению в коде
  material?: string // Поиск по вхождению по материалу (код или наименование)
  year?: string   // Год
  month?: string  // Месяц (в паре с year)
  full?: boolean  // Детальная информация (все материалы), только для name/code/material
}

/**
 * Строит endpoint для запроса спецификаций
 */
export function buildSpecificationsEndpoint(filters: SpecificationsFilters): string {
  const { name, code, material, year, month, full } = filters
  const hasName = !!name?.trim()
  const hasCode = !!code?.trim()
  const hasMaterial = !!material?.trim()
  const hasYear = !!year?.trim()
  const hasMonth = !!month?.trim()
  const hasFull = !!full

  const encodePath = (value: string): string => {
    const normalized = value
      .replaceAll("+", "_plus_")
      .replaceAll("-", "_dash_")
    return encodeURIComponent(normalized)
  }

  // Год + месяц
  if (hasYear && hasMonth) {
    return `specifications/get/year/${encodePath(year!)}/month/${encodePath(month!)}`
  }
  // Только год
  if (hasYear) {
    return `specifications/get/year/${encodePath(year!)}`
  }
  // Имя + опционально full
  if (hasName) {
    const base = `specifications/get/name/${encodePath(name!)}`
    return hasFull ? `${base}/full/1` : base
  }
  // Код + опционально full
  if (hasCode) {
    const base = `specifications/get/code/${encodePath(code!)}`
    return hasFull ? `${base}/full/1` : base
  }
  // Материал + опционально full
  if (hasMaterial) {
    const base = `specifications/get/material/${encodePath(material!)}`
    return hasFull ? `${base}/full/1` : base
  }

  return "specifications/get/list"
}

/**
 * Получение списка спецификаций с фильтрацией
 */
export async function getSpecifications(
  userMetadata: Record<string, unknown>,
  filters?: SpecificationsFilters
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters || {}
  const endpoint = buildSpecificationsEndpoint(f)
  return await client.get(endpoint)
}

/**
 * Параметры фильтрации складских остатков.
 * API 1С: balances/get/list | balances/get/code/{code} | balances/get/name/{name}
 */
export interface WarehouseBalancesFilters {
  code?: string  // Фильтр по коду
  name?: string  // Фильтр по наименованию
}

/**
 * Строит endpoint для запроса складских остатков.
 */
export function buildWarehouseBalancesEndpoint(filters: WarehouseBalancesFilters): string {
  const { code, name } = filters
  const hasCode = !!code?.trim()
  const hasName = !!name?.trim()

  const encodePath = (value: string): string => {
    const normalized = value
      .replaceAll("+", "_plus_")
      .replaceAll("-", "_dash_")
    return encodeURIComponent(normalized)
  }

  if (hasCode) return `balances/get/code/${encodePath(code!)}`
  if (hasName) return `balances/get/name/${encodePath(name!)}`
  return "balances/get/list"
}

/**
 * Получение складских остатков с фильтрацией
 */
export async function getWarehouseBalances(
  userMetadata: Record<string, unknown>,
  filters?: WarehouseBalancesFilters
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters || {}
  const endpoint = buildWarehouseBalancesEndpoint(f)
  return await client.get(endpoint)
}

/**
 * Дерево номенклатуры (материалов) из 1С: materials/get/list
 */
export async function getMaterials(userMetadata: Record<string, unknown>) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  return await client.get("materials/get/list")
}

/**
 * Список складов из 1С: warehouses/get/list
 */
export async function getWarehouses(userMetadata: Record<string, unknown>) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  return await client.get("warehouses/get/list")
}

/**
 * Параметры фильтрации платежей
 */
export interface PaymentsFilters {
  code?: string      // Номер платежа
  contractor?: string // Контрагент
  year?: string      // Год в коротком формате (24, 25, 26)
  org?: string       // Организация
  responsible?: string // Ответственный
  status?: string    // Статус
  full?: string      // Полные данные с вложениями (1 или 0)
}

/**
 * Строит endpoint для запроса платежей на основе фильтров.
 * 
 * Доступные комбинации в API 1С:
 * 1. list                                      → нет фильтров
 * 2. code/{x}                                  → code
 * 3. contractor/{x}                            → contractor
 * 4. org/{x}                                   → org
 * 5. responsible/{x}                           → responsible
 * 6. status/{x}                                → status
 * 7. contractor/{x}/status/{s}                 → contractor + status
 * 8. contractor/{x}/responsible/{r}             → contractor + responsible
 * 9. contractor/{x}/org/{o}                    → contractor + org
 * 10. responsible/{r}/status/{s}               → responsible + status
 * 11. responsible/{r}/org/{o}                  → responsible + org
 * 
 * Порядок сегментов фиксирован: contractor → responsible → org → status
 * Если передан параметр full=1, добавляется /full/1 в конец URL
 */
export function buildPaymentsEndpoint(filters: PaymentsFilters): string {
  const { code, contractor, org, responsible, status, full } = filters
  const hasCode = !!code?.trim()
  const hasContractor = !!contractor?.trim()
  const hasOrg = !!org?.trim()
  const hasResponsible = !!responsible?.trim()
  const hasStatus = !!status?.trim()

  // Кодируем спецсимволы для IIS/1C
  const encodePath = (value: string): string => {
    const normalized = value
      .replaceAll("+", "_plus_")
      .replaceAll("-", "_dash_")
    return encodeURIComponent(normalized)
  }

  let endpoint = ""

  // Фильтр по коду (не комбинируется с другими)
  if (hasCode) {
    endpoint = `payments/get/code/${encodePath(code!)}`
  }
  // Комбинации с contractor
  else if (hasContractor) {
    if (hasStatus) {
      endpoint = `payments/get/contractor/${encodePath(contractor!)}/status/${encodePath(status!)}`
    } else if (hasResponsible) {
      endpoint = `payments/get/contractor/${encodePath(contractor!)}/responsible/${encodePath(responsible!)}`
    } else if (hasOrg) {
      endpoint = `payments/get/contractor/${encodePath(contractor!)}/org/${encodePath(org!)}`
    } else {
      endpoint = `payments/get/contractor/${encodePath(contractor!)}`
    }
  }
  // Комбинации с responsible
  else if (hasResponsible) {
    if (hasStatus) {
      endpoint = `payments/get/responsible/${encodePath(responsible!)}/status/${encodePath(status!)}`
    } else if (hasOrg) {
      endpoint = `payments/get/responsible/${encodePath(responsible!)}/org/${encodePath(org!)}`
    } else {
      endpoint = `payments/get/responsible/${encodePath(responsible!)}`
    }
  }
  // Одиночные фильтры (1С не поддерживает org+status в одном запросе — статус применяется на клиенте)
  else if (hasOrg) {
    endpoint = `payments/get/org/${encodePath(org!)}`
  } else if (hasStatus) {
    endpoint = `payments/get/status/${encodePath(status!)}`
  }
  // Нет фильтров — полный список
  else {
    endpoint = "payments/get/list"
  }

  // Добавляем /full/1 если нужны полные данные с вложениями
  if (full === "1") {
    endpoint += "/full/1"
  }

  return endpoint
}

/**
 * Получение списка платежей (оплат) с фильтрацией
 */
export async function getPayments(userMetadata: Record<string, unknown>, filters?: PaymentsFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters || {}
  const endpoint = buildPaymentsEndpoint(f)
  return await client.get(endpoint)
}

/**
 * Параметры фильтрации поступлений
 * API 1С: receipts/get/list | get/code/{code} | get/code/{code}/year/{year} | get/contractor/... | get/org/... | get/year/... | get/material/...
 */
export interface ReceiptsFilters {
  code?: string
  year?: string
  contractor?: string
  org?: string
  material?: string
  full?: boolean
}

/**
 * Строит endpoint для запроса поступлений.
 * Порядок: code (+ year) | contractor (+ org, + year, + full) | org | year | material (+ full, + year) | list
 */
export function buildReceiptsEndpoint(filters: ReceiptsFilters): string {
  const { code, year, contractor, org, material, full } = filters
  const hasCode = !!code?.trim()
  const hasYear = !!year?.trim()
  const hasContractor = !!contractor?.trim()
  const hasOrg = !!org?.trim()
  const hasMaterial = !!material?.trim()
  const hasFull = !!full

  const encodePath = (value: string): string => {
    const normalized = value
      .replaceAll("+", "_plus_")
      .replaceAll("-", "_dash_")
    return encodeURIComponent(normalized)
  }

  if (hasCode) {
    const base = `receipts/get/code/${encodePath(code!)}`
    return hasYear ? `${base}/year/${encodePath(year!)}` : base
  }
  if (hasContractor) {
    if (hasOrg && hasYear && hasFull) {
      return `receipts/get/contractor/${encodePath(contractor!)}/org/${encodePath(org!)}/year/${encodePath(year!)}/full/1`
    }
    if (hasOrg && hasYear) {
      return `receipts/get/contractor/${encodePath(contractor!)}/org/${encodePath(org!)}/year/${encodePath(year!)}`
    }
    if (hasOrg) {
      return `receipts/get/contractor/${encodePath(contractor!)}/org/${encodePath(org!)}`
    }
    if (hasYear) {
      return `receipts/get/contractor/${encodePath(contractor!)}/year/${encodePath(year!)}`
    }
    return `receipts/get/contractor/${encodePath(contractor!)}`
  }
  if (hasOrg) {
    return `receipts/get/org/${encodePath(org!)}`
  }
  if (hasYear && !hasCode && !hasContractor && !hasMaterial) {
    return `receipts/get/year/${encodePath(year!)}`
  }
  if (hasMaterial) {
    const base = `receipts/get/material/${encodePath(material!)}`
    if (hasFull && hasYear) return `${base}/full/1/year/${encodePath(year!)}`
    if (hasFull) return `${base}/full/1`
    if (hasYear) return `${base}/year/${encodePath(year!)}`
    return base
  }
  return "receipts/get/list"
}

/**
 * Получение списка поступлений из 1С с фильтрацией
 */
export async function getReceipts(userMetadata: Record<string, unknown>, filters?: ReceiptsFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const f = filters || {}
  const endpoint = buildReceiptsEndpoint(f)
  return await client.get(endpoint)
}

/**
 * Требования-накладные (реализации). API 1С: demands/get/list | demands/get/code/{code}
 */
export type DemandItem = {
  Номер?: string
  Дата?: string
  Склад?: string
  Ответственный?: string
  Комментарий?: string
  Материалы?: string
  [key: string]: unknown
}

export async function getDemandsList(userMetadata: Record<string, unknown>): Promise<DemandItem[]> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const raw = await client.get<DemandItem[] | unknown>("demands/get/list")
  return Array.isArray(raw) ? raw : []
}

export async function getDemandByCode(userMetadata: Record<string, unknown>, code: string): Promise<DemandItem | unknown> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const encoded = code
    .replaceAll("+", "_plus_")
    .replaceAll("-", "_dash_")
  return await client.get<DemandItem>(`demands/get/code/${encodeURIComponent(encoded)}`)
}

/**
 * Перемещения товаров между складами. API 1С: transfers/get/list | transfers/get/code/{code} | transfers/get/code/{code}/full/1
 */
export type TransferItem = {
  Номер?: string
  Дата?: string
  СкладОтправитель?: string
  СкладПолучатель?: string
  Ответственный?: string
  Комментарий?: string
  Материалы?: string
  [key: string]: unknown
}

export type TransferGoodsRow = {
  НомерСтроки?: string
  Номенклатура?: string
  ХарактеристикаНоменклатуры?: string
  ЕдиницаИзмерения?: string
  Количество?: number
}

export type TransferFull = TransferItem & {
  Товары?: TransferGoodsRow[]
}

export type TransfersListResponse = TransferItem[]
export type TransfersFullResponse = { data: TransferFull[]; errors: string[] }

export async function getTransfersList(
  userMetadata: Record<string, unknown>,
  filters?: { code?: string }
): Promise<TransferItem[]> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const code = filters?.code?.trim()
  const endpoint = code
    ? `transfers/get/code/${encodeURIComponent(code.replaceAll("+", "_plus_").replaceAll("-", "_dash_"))}`
    : "transfers/get/list"
  const raw = await client.get<TransfersListResponse | unknown>(endpoint)
  return Array.isArray(raw) ? raw : []
}

export async function getTransferByCodeFull(
  userMetadata: Record<string, unknown>,
  code: string,
  year?: string
): Promise<TransfersFullResponse> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const encoded = code
    .trim()
    .replaceAll("+", "_plus_")
    .replaceAll("-", "_dash_")
  // Как в заказах поставщика: при year вызываем 1С с путём .../year/{year}/full/1; иначе — code/full/1 и выбираем по году у нас
  const pathYear = year?.trim() ? `/year/${encodeURIComponent(year)}` : ""
  const raw = await client.get<TransfersFullResponse>(`transfers/get/code/${encodeURIComponent(encoded)}${pathYear}/full/1`)
  if (!raw || typeof raw !== "object" || !("data" in raw) || !Array.isArray((raw as TransfersFullResponse).data)) {
    return { data: [], errors: [] }
  }
  const resp = raw as TransfersFullResponse
  if (!year?.trim()) return resp
  // Искомый год: параметр year уже в коротком виде (26), не прогоняем через yearNorm — иначе yearNorm("26") даёт ""
  const need = String(year).trim().slice(-2)
  // Год из даты в ответе 1С: dd.MM.yyyy или ISO
  const yearFromDate = (s: string) => {
    const t = String(s ?? "").trim()
    const fourDigit = t.match(/\d{4}/)?.[0]
    if (fourDigit) return String(fourDigit).slice(-2)
    const y = t.split(".")[2] ?? ""
    return y.length === 2 ? y : String(y).slice(-2)
  }
  const found = resp.data.filter((row: { Дата?: string }) => yearFromDate(row.Дата ?? "") === need)
  return { data: found.length ? [found[0]] : [], errors: resp.errors ?? [] }
}

export * from "@/lib/1c-client"

