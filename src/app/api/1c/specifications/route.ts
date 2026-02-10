import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSpecifications, type SpecificationsFilters } from "@/integrations/1c"

/**
 * GET /api/1c/specifications
 * Список спецификаций из 1С
 *
 * Query: name, code, material, year, month, full
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const metadata = user.user_metadata || {}
    const integrations = metadata.integrations as Record<string, unknown> | undefined
    const oneC = integrations?.["1c"] as { enabled: boolean } | undefined

    if (!oneC?.enabled) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена. Настройки → Интеграции." },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filters: SpecificationsFilters = {}

    const name = searchParams.get("name")
    const code = searchParams.get("code")
    const material = searchParams.get("material")
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const full = searchParams.get("full")

    if (name != null) filters.name = name
    if (code != null) filters.code = code
    if (material != null) filters.material = material
    if (year != null) filters.year = year
    if (month != null) filters.month = month
    if (full === "1" || full === "true") filters.full = true

    const data = await getSpecifications(metadata, filters)
    return NextResponse.json({ data, filters })
  } catch (error) {
    console.error("Ошибка получения спецификаций:", error)
    const message = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${message}` },
      { status: 500 }
    )
  }
}
