import { redirect } from "next/navigation"

/**
 * Редирект: /dashboard/construction/schedule → /construction/schedule
 * Нужен, чтобы сборка находила маршрут (артефакты .next ссылаются на этот путь).
 */
export default function DashboardConstructionSchedulePage() {
  redirect("/construction/schedule")
}
