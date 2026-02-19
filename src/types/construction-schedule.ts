// Типы для раздела «График монтажа» (на основе PDF «График заездов» и API)

/** Этапы объекта: даты или пустая строка */
export interface ScheduleStages {
  production?: string   // производство
  piles?: string        // устройство свай
  shipment?: string     // отгрузка с завода
  windows?: string      // окна
  windowsMount?: string // монтаж окон
  roof?: string         // кровля
  electrical?: string   // электрика
  plumbing?: string     // сантехника
  screed?: string       // стяжка
  exterior?: string     // наружка
  handover?: string     // сдача
}

/** Объект графика (одна строка = один заказ/дом) — мок/legacy */
export interface ConstructionObjectLegacy {
  id: string
  territoryId: string
  location: string           // населённый пункт
  orderCode: string          // номер договора (101А/25, 112А/25, ...)
  type: "ПКД" | "МД"
  escrowEgrn: string         // эскроу/ЕГРН (344, 368, ...)
  project: string           // модель дома (Норвегия L, Барн 90, ...)
  manager: string
  amount: number             // сумма, руб.
  launchDate?: string        // дата запуска (DD.MM.YYYY)
  stages: ScheduleStages
  statusComment: string      // статус/комментарий
  documentNumber?: string    // № заявки
}

/** Объект строительства (раздел Объекты, БД: construction_object) */
export interface ConstructionObjectApi {
  id: string
  addressId?: string | null
  contractId?: string | null
  contractNumber: string
  kitNo?: number | null
  buildType?: string | null
  projectId?: string | null
  projectName?: string | null
  foremanId?: string | null
  foremanName?: string | null
  amountCurrent?: number | null
  amountNext?: number | null
  contractStartDate?: string | null // YYYY-MM-DD
  comment?: string | null
  addressDisplay?: string | null
  createdAt?: string
  updatedAt?: string
}

/** Тело создания/обновления объекта (POST/PATCH /api/construction/objects) */
export interface ConstructionObjectCreateBody {
  addressId?: string | null
  contractId?: string | null
  contractNumber: string
  kitNo?: number | null
  buildType?: string | null
  projectId?: string | null
  projectName?: string | null
  foremanId?: string | null
  foremanName?: string | null
  amountCurrent?: number | null
  amountNext?: number | null
  contractStartDate?: string | null
  comment?: string | null
}

/** Территория (группировка по зонам) */
export interface Territory {
  id: string
  name: string
  order: number
}

// --- API и форма графика монтажа (БД: MountScheduleEntry, Address) ---

/** Адрес из БД — для отображения и формы */
export interface AddressApi {
  id: string
  region?: string | null
  district?: string | null
  locality?: string | null
  street?: string | null
  house?: string | null
  fullText?: string | null
  displayFull?: string
}

/** Тело создания/обновления адреса (из DaData или ручной ввод) */
export interface AddressCreateBody {
  region?: string | null
  district?: string | null
  locality?: string | null
  street?: string | null
  house?: string | null
  fullText?: string | null
  kladrCode?: string | null
  fiasId?: string | null
  isCustom?: boolean
}

/** Одна запись графика в ответе GET /api/construction/mount-schedule */
export interface MountScheduleEntryApi {
  id: string
  planMonth: string
  contractId?: string | null
  contractNumber: string
  kitNo?: number | null
  addressId?: string | null
  addressDisplay?: string | null
  buildType?: string | null
  projectId?: string | null
  projectName?: string | null
  foremanId?: string | null
  foremanName?: string | null
  amountDisplay?: number | null
  amountCurrent?: number | null
  amountNext?: number | null
  productionLaunchDate?: string | null
  shipmentDate?: string | null
  roofWorkDate?: string | null
  handoverDate?: string | null
  mountStartDate?: string | null // Утверждённая дата начала монтажа
  statusSummary?: string | null
  statusSummaryOverride?: string | null
  productionStatus?: string | null
  comment?: string | null
  sortOrder?: number | null
  createdAt: string
  updatedAt: string
}

/** Тело POST /api/construction/mount-schedule (создание) */
export interface MountScheduleEntryCreateBody {
  planMonth: string
  contractId?: string | null
  contractNumber: string
  kitNo?: number | null
  addressId?: string | null
  address?: AddressCreateBody | null
  buildType?: string | null
  projectId?: string | null
  projectName?: string | null
  foremanId?: string | null
  foremanName?: string | null
  amountCurrent?: number | null
  amountNext?: number | null
  productionLaunchDate?: string | null
  productionStatus?: string | null
  shipmentDate?: string | null
  roofWorkDate?: string | null
  handoverDate?: string | null
  mountStartDate?: string | null
  statusSummaryOverride?: string | null
  comment?: string | null
  sortOrder?: number | null
}

/** Тело PATCH /api/construction/mount-schedule/[id] */
export type MountScheduleEntryUpdateBody = Partial<MountScheduleEntryCreateBody>

/** Ответ GET списка графика */
export interface MountScheduleListResponse {
  items: MountScheduleEntryApi[]
  total: number
}

/** Элемент подсказки DaData suggest (поле data) */
export interface DaDataSuggestionAddress {
  region?: string | null
  region_with_type?: string | null
  area?: string | null
  city?: string | null
  settlement?: string | null
  street?: string | null
  street_with_type?: string | null
  house?: string | null
  block?: string | null
  kladr_id?: string | null
  fias_id?: string | null
  value?: string | null
  unrestricted_value?: string | null
}

/** Ответ DaData suggest (адреса) */
export interface DaDataSuggestResponse {
  suggestions?: Array<{ value: string; unrestricted_value?: string; data?: DaDataSuggestionAddress }>
}

/** Справочник: прораб */
export interface EmployeeApi {
  id: string
  name: string
}

/** Справочник: типовой проект */
export interface ProjectCatalogApi {
  id: string
  name: string
}

/** Договор (для combobox) */
export interface ContractApi {
  id: string
  contractNumber: string
  kitNo?: number | null
  addressId?: string | null
  addressDisplay?: string | null
  buildType?: string | null
  projectId?: string | null
  projectName?: string | null
  foremanId?: string | null
  foremanName?: string | null
  amount?: number | null
}
