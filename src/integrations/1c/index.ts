/**
 * Интеграция с 1С
 * Запросы к HTTP API по документации bsl/: единый метод get на сервис, параметры в query-string.
 * Ответ: { data: T[], errors: string[] }; при 500 — { error: string }.
 */

import { createOneCClient, type OneCCredentials, type OneCEnvironment } from "@/lib/1c-client"

/** Строит query-string из объекта (пустые/undefined не попадают). */
function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

/** Нормализация булева для API 1С (1, true, yes, да). */
function toApiBool(v: boolean): string {
  return v ? "1" : "0"
}

/** Парсит ответ API: { data, errors } или массив (старый формат). */
function parseDataResponse<T>(raw: unknown): { data: T[]; errors: string[] } {
  if (raw != null && typeof raw === "object" && "data" in raw) {
    const r = raw as { data?: unknown; errors?: unknown }
    const data = Array.isArray(r.data) ? (r.data as T[]) : []
    const errors = Array.isArray(r.errors) ? (r.errors as string[]) : []
    return { data, errors }
  }
  if (Array.isArray(raw)) return { data: raw as T[], errors: [] }
  return { data: [], errors: [] }
}

/**
 * Параметры фильтрации заказов поставщикам.
 * API 1С: supplier-orders/get (from, to, code, date, supplier, org, warehouse, responsible, comment, summ, approved, full).
 */
export interface SordersFilters {
  code?: string
  contractor?: string   // в API 1С — supplier
  year?: string        // короткий год (24, 25) → from/to
  from?: string
  to?: string
  date?: string
  org?: string
  warehouse?: string
  responsible?: string
  comment?: string
  summ?: number
  approved?: boolean
  full?: boolean
}

/** Преобразует год (24, 25) в from/to dd.MM.yyyy. */
function yearToFromTo(year: string): { from: string; to: string } {
  const y = year.trim().slice(-2)
  const fullYear = y.length === 2 ? `20${y}` : year
  return { from: `01.01.${fullYear}`, to: `31.12.${fullYear}` }
}

/**
 * Строит endpoint supplier-orders/get с query-параметрами.
 */
export function buildSordersEndpoint(filters: SordersFilters): string {
  const q: Record<string, string | number | undefined> = {}
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.from?.trim()) q.from = filters.from.trim()
  if (filters.to?.trim()) q.to = filters.to.trim()
  if (filters.date?.trim()) q.date = filters.date.trim()
  if (filters.contractor?.trim()) q.supplier = filters.contractor.trim()
  if (filters.org?.trim()) q.org = filters.org.trim()
  if (filters.warehouse?.trim()) q.warehouse = filters.warehouse.trim()
  if (filters.responsible?.trim()) q.responsible = filters.responsible.trim()
  if (filters.comment?.trim()) q.comment = filters.comment.trim()
  if (filters.summ != null) q.summ = filters.summ
  if (filters.approved != null) q.approved = toApiBool(filters.approved)
  if (filters.full) q.full = "1"
  if (filters.year?.trim() && !q.from && !q.to) {
    const { from, to } = yearToFromTo(filters.year)
    q.from = from
    q.to = to
  }
  return `supplier-orders/get${buildQueryString(q)}`
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
 * Получение списка заказов поставщикам с фильтрацией.
 */
export async function getSupplierOrders(userMetadata: Record<string, unknown>, filters?: SordersFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters ?? {}
  const endpoint = buildSordersEndpoint(f)
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Параметры фильтрации спецификаций.
 * API 1С: specifications/get (параметры: code, name, material, ngroup, year, month, full).
 */
export interface SpecificationsFilters {
  name?: string
  code?: string
  material?: string
  ngroup?: string
  year?: string
  month?: string
  full?: boolean
}

/** Строит endpoint specifications/get с query-параметрами. */
export function buildSpecificationsEndpoint(filters: SpecificationsFilters): string {
  const q: Record<string, string | undefined> = {}
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.name?.trim()) q.name = filters.name.trim()
  if (filters.material?.trim()) q.material = filters.material.trim()
  if (filters.ngroup?.trim()) q.ngroup = filters.ngroup.trim()
  if (filters.year?.trim()) q.year = filters.year.trim()
  if (filters.month?.trim()) q.month = filters.month.trim()
  if (filters.full) q.full = "1"
  return `specifications/get${buildQueryString(q)}`
}

/**
 * Получение списка спецификаций с фильтрацией.
 */
export async function getSpecifications(
  userMetadata: Record<string, unknown>,
  filters?: SpecificationsFilters
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters ?? {}
  const endpoint = buildSpecificationsEndpoint(f)
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Параметры фильтрации складских остатков.
 * API 1С: balances/get (code, name, warehouse, date, full).
 */
export interface WarehouseBalancesFilters {
  code?: string
  name?: string
  warehouse?: string
  date?: string
  full?: boolean
}

/**
 * Строит endpoint balances/get с query-параметрами.
 */
export function buildWarehouseBalancesEndpoint(filters: WarehouseBalancesFilters): string {
  const q: Record<string, string | undefined> = {}
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.name?.trim()) q.name = filters.name.trim()
  if (filters.warehouse?.trim()) q.warehouse = filters.warehouse.trim()
  if (filters.date?.trim()) q.date = filters.date.trim()
  if (filters.full) q.full = "1"
  return `balances/get${buildQueryString(q)}`
}

/**
 * Получение складских остатков с фильтрацией.
 */
export async function getWarehouseBalances(
  userMetadata: Record<string, unknown>,
  filters?: WarehouseBalancesFilters
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters ?? {}
  const endpoint = buildWarehouseBalancesEndpoint(f)
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Дерево номенклатуры (материалов) из 1С: materials/get (опционально code, name, group, type, ngroup, article, supplier, service).
 */
export async function getMaterials(
  userMetadata: Record<string, unknown>,
  filters?: { code?: string; name?: string; group?: string; type?: string; ngroup?: string; article?: string; supplier?: string; service?: boolean }
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const q: Record<string, string | undefined> = {}
  if (filters?.code?.trim()) q.code = filters.code.trim()
  if (filters?.name?.trim()) q.name = filters.name.trim()
  if (filters?.group?.trim()) q.group = filters.group.trim()
  if (filters?.type?.trim()) q.type = filters.type.trim()
  if (filters?.ngroup?.trim()) q.ngroup = filters.ngroup.trim()
  if (filters?.article?.trim()) q.article = filters.article.trim()
  if (filters?.supplier?.trim()) q.supplier = filters.supplier.trim()
  if (filters?.service != null) q.service = String(filters.service)
  const endpoint = `materials/get${buildQueryString(q)}`
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Список складов из 1С: warehouses/get (опционально code, name).
 */
export async function getWarehouses(
  userMetadata: Record<string, unknown>,
  filters?: { code?: string; name?: string; group?: string }
) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const q: Record<string, string | undefined> = {}
  if (filters?.code?.trim()) q.code = filters.code.trim()
  if (filters?.name?.trim()) q.name = filters.name.trim()
  if (filters?.group?.trim()) q.group = filters.group.trim()
  const endpoint = `warehouses/get${buildQueryString(q)}`
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Параметры фильтрации поставщиков (API: suppliers/get — name, inn, full).
 */
export interface SuppliersFilters {
  inn?: string
  name?: string
  full?: boolean
}

/**
 * Строит endpoint suppliers/get с query-параметрами.
 */
export function buildSuppliersEndpoint(filters: SuppliersFilters): string {
  const q: Record<string, string | undefined> = {}
  if (filters.name?.trim()) q.name = filters.name.trim()
  if (filters.inn?.trim()) q.inn = filters.inn.trim()
  if (filters.full) q.full = "1"
  return `suppliers/get${buildQueryString(q)}`
}

/**
 * Список поставщиков из 1С: suppliers/get (name, inn, full).
 */
export async function getSuppliers(userMetadata: Record<string, unknown>, filters?: SuppliersFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const endpoint = buildSuppliersEndpoint(filters ?? {})
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Параметры фильтрации платежей.
 * API 1С: payments/get (from, to, code, date, responsible, recipient, contractor, cash, comment, status, summ, approved, full).
 */
export interface PaymentsFilters {
  code?: string
  contractor?: string
  year?: string
  org?: string
  responsible?: string
  recipient?: string
  cash?: string
  comment?: string
  status?: string
  summ?: number
  approved?: boolean
  full?: string
  from?: string
  to?: string
  date?: string
}

/**
 * Строит endpoint payments/get с query-параметрами.
 */
export function buildPaymentsEndpoint(filters: PaymentsFilters): string {
  const q: Record<string, string | number | undefined> = {}
  if (filters.from?.trim()) q.from = filters.from.trim()
  if (filters.to?.trim()) q.to = filters.to.trim()
  if (filters.year?.trim() && !q.from && !q.to) {
    const y = filters.year.trim().slice(-2)
    const fullYear = y.length === 2 ? `20${y}` : filters.year
    q.from = `01.01.${fullYear}`
    q.to = `31.12.${fullYear}`
  }
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.date?.trim()) q.date = filters.date.trim()
  if (filters.responsible?.trim()) q.responsible = filters.responsible.trim()
  if (filters.recipient?.trim()) q.recipient = filters.recipient.trim()
  if (filters.contractor?.trim()) q.contractor = filters.contractor.trim()
  if (filters.cash?.trim()) q.cash = filters.cash.trim()
  if (filters.comment?.trim()) q.comment = filters.comment.trim()
  if (filters.status?.trim()) q.status = filters.status.trim()
  if (filters.summ != null) q.summ = filters.summ
  if (filters.approved != null) q.approved = toApiBool(filters.approved)
  if (filters.full === "1") q.full = "1"
  return `payments/get${buildQueryString(q)}`
}

/**
 * Получение списка платежей (оплат) с фильтрацией.
 */
export async function getPayments(userMetadata: Record<string, unknown>, filters?: PaymentsFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")

  const client = createOneCClient(credentials)
  const f = filters ?? {}
  const endpoint = buildPaymentsEndpoint(f)
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Параметры фильтрации поступлений.
 * API 1С: receipts/get (from, to, code, date, contractor, org, warehouse, responsible, summ, approved, full).
 */
export interface ReceiptsFilters {
  code?: string
  year?: string
  contractor?: string
  org?: string
  warehouse?: string
  responsible?: string
  material?: string
  summ?: number
  approved?: boolean
  full?: boolean
  from?: string
  to?: string
  date?: string
}

/**
 * Строит endpoint receipts/get с query-параметрами.
 */
export function buildReceiptsEndpoint(filters: ReceiptsFilters): string {
  const q: Record<string, string | number | undefined> = {}
  if (filters.from?.trim()) q.from = filters.from.trim()
  if (filters.to?.trim()) q.to = filters.to.trim()
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.date?.trim()) q.date = filters.date.trim()
  if (filters.contractor?.trim()) q.contractor = filters.contractor.trim()
  if (filters.org?.trim()) q.org = filters.org.trim()
  if (filters.warehouse?.trim()) q.warehouse = filters.warehouse.trim()
  if (filters.responsible?.trim()) q.responsible = filters.responsible.trim()
  if (filters.material?.trim()) q.material = filters.material.trim()
  if (filters.summ != null) q.summ = filters.summ
  if (filters.approved != null) q.approved = toApiBool(filters.approved)
  if (filters.full) q.full = "1"
  if (filters.year?.trim() && !q.from && !q.to) {
    const y = filters.year.trim().slice(-2)
    const fullYear = y.length === 2 ? `20${y}` : filters.year
    q.from = `01.01.${fullYear}`
    q.to = `31.12.${fullYear}`
  }
  return `receipts/get${buildQueryString(q)}`
}

/**
 * Получение списка поступлений из 1С с фильтрацией.
 */
export async function getReceipts(userMetadata: Record<string, unknown>, filters?: ReceiptsFilters) {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const f = filters ?? {}
  const endpoint = buildReceiptsEndpoint(f)
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse(raw)
  return data
}

/**
 * Требования-накладные. API 1С: demands/get (параметры: code, from, to, warehouse, responsible, full).
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

export interface DemandsFilters {
  code?: string
  from?: string
  to?: string
  warehouse?: string
  responsible?: string
  full?: boolean
}

function buildDemandsEndpoint(filters: DemandsFilters): string {
  const q: Record<string, string | undefined> = {}
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.from?.trim()) q.from = filters.from.trim()
  if (filters.to?.trim()) q.to = filters.to.trim()
  if (filters.warehouse?.trim()) q.warehouse = filters.warehouse.trim()
  if (filters.responsible?.trim()) q.responsible = filters.responsible.trim()
  if (filters.full) q.full = "1"
  return `demands/get${buildQueryString(q)}`
}

export async function getDemandsList(
  userMetadata: Record<string, unknown>,
  filters?: DemandsFilters
): Promise<DemandItem[]> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const endpoint = buildDemandsEndpoint(filters ?? {})
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse<DemandItem>(raw)
  return data
}

export async function getDemandByCode(
  userMetadata: Record<string, unknown>,
  code: string,
  full?: boolean
): Promise<DemandItem | null> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const enc = code.replaceAll("+", "_plus_").replaceAll("-", "_dash_")
  const endpoint = buildDemandsEndpoint({ code: enc, full: full ?? true })
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse<DemandItem>(raw)
  return data[0] ?? null
}

/**
 * Перемещения товаров. API 1С: transfers/get (параметры в query: code, from, to, date, responsible, sender, receiver, full).
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

export interface TransfersFilters {
  code?: string
  from?: string
  to?: string
  date?: string
  responsible?: string
  sender?: string
  receiver?: string
  full?: boolean
}

/** Строит endpoint transfers/get с query-параметрами. */
function buildTransfersEndpoint(filters: TransfersFilters): string {
  const q: Record<string, string | undefined> = {}
  if (filters.code?.trim()) q.code = filters.code.trim()
  if (filters.from?.trim()) q.from = filters.from.trim()
  if (filters.to?.trim()) q.to = filters.to.trim()
  if (filters.date?.trim()) q.date = filters.date.trim()
  if (filters.responsible?.trim()) q.responsible = filters.responsible.trim()
  if (filters.sender?.trim()) q.sender = filters.sender.trim()
  if (filters.receiver?.trim()) q.receiver = filters.receiver.trim()
  if (filters.full) q.full = "1"
  return `transfers/get${buildQueryString(q)}`
}

export async function getTransfersList(
  userMetadata: Record<string, unknown>,
  filters?: TransfersFilters
): Promise<TransferItem[]> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const endpoint = buildTransfersEndpoint(filters ?? {})
  const raw = await client.get<unknown>(endpoint)
  const { data } = parseDataResponse<TransferItem>(raw)
  return data
}

export async function getTransferByCodeFull(
  userMetadata: Record<string, unknown>,
  code: string,
  year?: string
): Promise<TransfersFullResponse> {
  const credentials = await getOneCCredentials(userMetadata)
  if (!credentials) throw new Error("1С не настроена")
  const client = createOneCClient(credentials)
  const enc = code.trim().replaceAll("+", "_plus_").replaceAll("-", "_dash_")
  const q: Record<string, string> = { code: enc, full: "1" }
  if (year?.trim()) {
    const y = year.trim().slice(-2)
    const fullYear = y.length === 2 ? `20${y}` : year
    q.from = `01.01.${fullYear}`
    q.to = `31.12.${fullYear}`
  }
  const endpoint = `transfers/get${buildQueryString(q)}`
  const raw = await client.get<unknown>(endpoint)
  const { data, errors } = parseDataResponse<TransferFull>(raw)
  if (!year?.trim()) return { data, errors }
  const need = String(year).trim().slice(-2)
  const yearFromDate = (s: string) => {
    const t = String(s ?? "").trim()
    const fourDigit = t.match(/\d{4}/)?.[0]
    if (fourDigit) return String(fourDigit).slice(-2)
    const y = t.split(".")[2] ?? ""
    return y.length === 2 ? y : String(y).slice(-2)
  }
  const found = data.filter((row) => yearFromDate(row.Дата ?? "") === need)
  return { data: found.length ? [found[0]] : [], errors }
}

export * from "@/lib/1c-client"

