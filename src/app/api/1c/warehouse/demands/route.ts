import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDemandsList, type DemandsFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/warehouse/demands
 * Список требований-накладных из 1С demands/get. Параметры: from, to (dd.MM.yyyy), code, warehouse, responsible, full.
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
    const oneC = integrations?.["1c"] as { enabled?: boolean } | undefined

    if (!oneC?.enabled) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена. Настройте в разделе Настройки → Интеграции." },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filters: DemandsFilters = {}
    const from = searchParams.get("from")?.trim()
    const to = searchParams.get("to")?.trim()
    const code = searchParams.get("code")?.trim()
    const warehouse = searchParams.get("warehouse")?.trim()
    const responsible = searchParams.get("responsible")?.trim()
    const full = searchParams.get("full")
    if (from) filters.from = from
    if (to) filters.to = to
    if (code) filters.code = code
    if (warehouse) filters.warehouse = warehouse
    if (responsible) filters.responsible = responsible
    if (full === "1" || full === "true" || full === "yes" || (full && full.toLowerCase() === "full")) filters.full = true

    const cacheKey = buildCacheKey("1c:warehouse:demands", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown[] }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const data = await getDemandsList(metadata, Object.keys(filters).length > 0 ? filters : undefined)
    const body = { data }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения требований-накладных:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
