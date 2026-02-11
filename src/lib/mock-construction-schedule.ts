// Моковые данные для «График монтажа» на основе PDF «График заездов 2026-2025 — План март»
import type { ConstructionObject, Territory } from "@/types/construction-schedule"

export const TERRITORIES: Territory[] = [
  { id: "nn", name: "Н.Новгород, Арзамас, Кстово", order: 1 },
  { id: "pavlovo", name: "Павлово, Богородское", order: 2 },
  { id: "bor", name: "Бор, Чкаловск, Балахна, Городец", order: 3 },
  { id: "dz", name: "Дзержинск и регионы", order: 4 },
]

export const MOCK_SCHEDULE_OBJECTS: ConstructionObject[] = [
  // Н.Новгород, Арзамас, Кстово
  { id: "obj-1", territoryId: "nn", location: "Килилей", orderCode: "101А/25", type: "ПКД", escrowEgrn: "344", project: "Норвегия L", manager: "Ухин", amount: 6_179_000, launchDate: "06.02.2026", stages: { roof: "12.2", electrical: "16.02.26", plumbing: "23.2" }, statusComment: "Стройка. Ждем Теплый контур. Монтаж завершен.", documentNumber: "№2117133" },
  { id: "obj-2", territoryId: "nn", location: "Каменки", orderCode: "112А/25", type: "МД", escrowEgrn: "368", project: "Барн 90", manager: "Ухин", amount: 7_450_000, launchDate: "18.02.2026", stages: { production: "16.02", shipment: "18.02.2026", roof: "21.2", electrical: "25.2", handover: "20.02.2026" }, statusComment: "Ждем Теплый контур. Монтаж на производстве. В производстве 10.02.", documentNumber: "№2125030" },
  { id: "obj-3", territoryId: "nn", location: "Каменки", orderCode: "18Д/25", type: "ПКД", escrowEgrn: "380", project: "Норвегия L", manager: "Ухин", amount: 7_335_000, launchDate: "28.02.2025", stages: { windows: "09.03", windowsMount: "11 марта", handover: "28.03.2026" }, statusComment: "Ждем Теплый контур. Не оплачены. Сделать заявку Монтаж.", documentNumber: "№2128386" },
  { id: "obj-4", territoryId: "nn", location: "Н.Новгород", orderCode: "111А/25", type: "МД", escrowEgrn: "367", project: "Барн 90", manager: "Ухин", amount: 7_450_000, launchDate: "26.02.2026", stages: { roof: "1 марта", electrical: "4 марта", handover: "12.03.2026" }, statusComment: "Ждем Теплый контур. Участок не готов к свайным работам. Монтаж на производстве. НЕ ВЫБРАНА КРОВЛЯ!", documentNumber: "№2124044" },
  { id: "obj-5", territoryId: "nn", location: "Н.Новгород", orderCode: "13Д/25", type: "ПКД", escrowEgrn: "378", project: "Прованс 163", manager: "Ухин", amount: 8_881_200, launchDate: "14.03.2025", stages: {}, statusComment: "В работе." },
  { id: "obj-6", territoryId: "nn", location: "Гремячки", orderCode: "128А/25", type: "ПКД", escrowEgrn: "390", project: "Норвегия L", manager: "Ухин", amount: 7_145_000, launchDate: "18.03.2026", stages: { shipment: "20.03.2026", handover: "30.03.2025" }, statusComment: "В работе." },
  // Павлово, Богородское
  { id: "obj-7", territoryId: "pavlovo", location: "Павлово", orderCode: "87А/25ЭД", type: "ПКД", escrowEgrn: "347", project: "Шведский М", manager: "Илюшин", amount: 6_320_000, launchDate: "25.12", stages: { roof: "20.02–23.02", electrical: "20.02–23.02", handover: "05.03.2026" }, statusComment: "Стройка. Ждем Теплый контур. Монтаж завершен. Отгрузка на объект 25.12 ✅", documentNumber: "№2114245" },
  { id: "obj-8", territoryId: "pavlovo", location: "Москва", orderCode: "113А/25", type: "МД", escrowEgrn: "369", project: "Simple 71", manager: "Илюшин", amount: 5_190_400, launchDate: "10.03.2026", stages: {}, statusComment: "Ждем Теплый контур. Согласование ДДН. Монтаж на производстве." },
  { id: "obj-9", territoryId: "pavlovo", location: "Иваново", orderCode: "116А/25", type: "ПКД", escrowEgrn: "372", project: "Норвегия L", manager: "Илюшин", amount: 5_000_000, launchDate: "16.02.2026", stages: { handover: "20.03.2026" }, statusComment: "Забил сваи. Ждем Теплый контур. Не оплачены. Сделать заявку на монтаж.", documentNumber: "№2127759" },
  { id: "obj-10", territoryId: "pavlovo", location: "Иваново", orderCode: "31/25", type: "ПКД", escrowEgrn: "385", project: "Норвегия L", manager: "Илюшин", amount: 4_072_000, launchDate: "01.03.2025", stages: { production: "01.03.2025", piles: "04.03.2025", handover: "07.03.2025" }, statusComment: "" },
  // Бор, Чкаловск, Балахна, Городец
  { id: "obj-11", territoryId: "bor", location: "Чкаловск", orderCode: "20Д/25", type: "ПКД", escrowEgrn: "381", project: "ИНД", manager: "Грушуткин", amount: 2_577_900, launchDate: "02.03.2025", stages: { production: "02.03.2025", piles: "04.03.2025", handover: "14.03.2025" }, statusComment: "" },
  { id: "obj-12", territoryId: "bor", location: "Кстово", orderCode: "119А/25", type: "ПКД", escrowEgrn: "376", project: "Экохаус 128", manager: "Грушуткин", amount: 5_451_000, launchDate: "28.02.2025", stages: {}, statusComment: "Запущены. Не производим." },
  { id: "obj-13", territoryId: "bor", location: "Чкаловск", orderCode: "117А/25", type: "ПКД", escrowEgrn: "374", project: "ИНД", manager: "Грушуткин", amount: 9_700_000, launchDate: "10.03.2025", stages: {}, statusComment: "Не производим." },
  { id: "obj-14", territoryId: "bor", location: "Володарск", orderCode: "30/85", type: "МД", escrowEgrn: "382", project: "Simple 85", manager: "Жуков", amount: 3_716_000, launchDate: "28.02.2026", stages: { production: "28.02.2026", shipment: "05.03.2026", handover: "16.03.2025" }, statusComment: "" },
  { id: "obj-15", territoryId: "bor", location: "Москва", orderCode: "125А/25", type: "ПКД", escrowEgrn: "387", project: "Экохаус 132", manager: "Жуков", amount: 9_430_750, launchDate: "20.03.2026", stages: { production: "20.03.2026", shipment: "25.03.2026", handover: "20.04.2025" }, statusComment: "Не производим." },
  { id: "obj-16", territoryId: "bor", location: "Чебоксары", orderCode: "126А/25", type: "ПКД", escrowEgrn: "388", project: "Шведский 66", manager: "Жуков", amount: 3_256_000, launchDate: "26.02.2026", stages: { production: "26.02.2026", shipment: "01.03.2026", handover: "30.03.2025" }, statusComment: "Не производим." },
  // Дзержинск и регионы
  { id: "obj-17", territoryId: "dz", location: "Москва", orderCode: "102А/25", type: "ПКД", escrowEgrn: "357", project: "Барнхаус 131", manager: "Игонин", amount: 8_781_300, launchDate: "13.03.2025", stages: {}, statusComment: "Стройка." },
  { id: "obj-18", territoryId: "dz", location: "Москва", orderCode: "109А/25", type: "ПКД", escrowEgrn: "363", project: "Барнхаус 131", manager: "Игонин", amount: 9_042_000, launchDate: "20.03.2025", stages: {}, statusComment: "Стройка." },
  { id: "obj-19", territoryId: "dz", location: "Москва", orderCode: "10Д/25", type: "ПКД", escrowEgrn: "373", project: "Шведский М", manager: "Игонин", amount: 7_343_500, launchDate: "30.03.2025", stages: {}, statusComment: "Стройка." },
  { id: "obj-20", territoryId: "dz", location: "Москва", orderCode: "121А/25", type: "МД", escrowEgrn: "379", project: "Барн 90", manager: "Игонин", amount: 7_069_000, launchDate: "01.03.2026", stages: { production: "01.03.2026", shipment: "03.03.2026", handover: "10.03.2026" }, statusComment: "Ждем Теплый контур. Не оплачены. Монтаж на производстве. В производстве к 25.02.", documentNumber: "№2124926" },
  { id: "obj-21", territoryId: "dz", location: "Москва", orderCode: "122А/25", type: "ПКД", escrowEgrn: "383", project: "Норвегия L", manager: "Игонин", amount: 6_150_000, launchDate: "27.02.2026", stages: { production: "27.02.2026", shipment: "03.03.2026", handover: "31.03.2025" }, statusComment: "" },
  { id: "obj-22", territoryId: "dz", location: "Москва", orderCode: "32Д/25", type: "МД", escrowEgrn: "393", project: "Барнхаус L", manager: "Игонин", amount: 0, launchDate: "09.03.2026", stages: { production: "09.03.2026", shipment: "10.03.2026", handover: "31.03.2025" }, statusComment: "" },
]

/** Суммы по прорабам (из PDF) для отображения в блоке итогов */
export const MOCK_MANAGER_TOTALS: { manager: string; amount: number }[] = [
  { manager: "Ухин", amount: 44_449_200 },
  { manager: "Илюшин", amount: 20_582_400 },
  { manager: "Грушуткин", amount: 17_728_900 },
  { manager: "Жуков", amount: 16_403_750 },
  { manager: "Игонин", amount: 38_385_800 },
]
