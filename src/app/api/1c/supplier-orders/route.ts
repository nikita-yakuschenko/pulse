import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupplierOrders, type SordersFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/supplier-orders
 * Получает список заказов поставщикам из 1С. Кэш в Redis.
 * Query: code, contractor, from, to (формат dd.MM.yyyy), full. Параметр year не используется в текущей версии API 1С — при наличии year конвертируем в from/to.
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
        { error: "Интеграция 1С не настроена. Настройте в разделе Настройки → Интеграции." },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filters: SordersFilters = {}

    const code = searchParams.get("code")
    const contractor = searchParams.get("contractor")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const year = searchParams.get("year")
    const full = searchParams.get("full")

    if (code) filters.code = code
    if (contractor) filters.contractor = contractor
    if (from) filters.from = from
    if (to) filters.to = to
    if (year && !filters.from && !filters.to) {
      const y = year.trim().slice(-2)
      const fullYear = y.length === 2 ? `20${y}` : year
      filters.from = `01.01.${fullYear}`
      filters.to = `31.12.${fullYear}`
    }
    if (full === "1" || full === "true" || full === "yes" || (full && full.toLowerCase() === "full")) filters.full = true

    const cacheKey = buildCacheKey("1c:supplier-orders", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown; filters: SordersFilters }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const orders = await getSupplierOrders(metadata, filters)
    const body = { data: orders, filters }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения заказов поставщикам:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
