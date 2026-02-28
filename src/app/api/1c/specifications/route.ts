import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSpecifications, type SpecificationsFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/specifications
 * Список спецификаций из 1С. Кэш в Redis.
 * Query: name, code, material, from, to (dd.MM.yyyy), full. Обратная совместимость: year, month → конвертируем в from/to.
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
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const full = searchParams.get("full")

    if (name != null) filters.name = name
    if (code != null) filters.code = code
    if (material != null) filters.material = material
    if (from) filters.from = from
    if (to) filters.to = to
    if (year && !filters.from && !filters.to) {
      const y = year.trim().slice(-2)
      const fullYear = y.length === 2 ? `20${y}` : year
      filters.from = month
        ? `01.${String(month).padStart(2, "0")}.${fullYear}`
        : `01.01.${fullYear}`
      if (month) {
        const lastDay = new Date(Number(fullYear), Number(month), 0)
        filters.to = `${String(lastDay.getDate()).padStart(2, "0")}.${String(lastDay.getMonth() + 1).padStart(2, "0")}.${fullYear}`
      } else {
        filters.to = `31.12.${fullYear}`
      }
    }
    if (full === "1" || full === "true" || full === "yes" || (full && full.toLowerCase() === "full")) filters.full = true

    const cacheKey = buildCacheKey("1c:specifications", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown; filters: SpecificationsFilters }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const data = await getSpecifications(metadata, filters)
    const body = { data, filters }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения спецификаций:", error)
    const message = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${message}` },
      { status: 500 }
    )
  }
}
