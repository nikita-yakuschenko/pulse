// Типы для раздела «График монтажа» (на основе PDF «График заездов»)

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

/** Объект графика (одна строка = один заказ/дом) */
export interface ConstructionObject {
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

/** Территория (группировка по зонам) */
export interface Territory {
  id: string
  name: string
  order: number
}
