import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWarehouseBalances } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

/**
 * GET /api/1c/warehouse/balances-full
 * Получает складские остатки из 1С по ВСЕМ складам (для QR-кодов и детального просмотра).
 */
export async function GET() {
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

    const cacheKey = buildCacheKey("1c:warehouse:balances:full", user.id)
    const cached = await cacheGet<{ data: unknown }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const rawBalances = await getWarehouseBalances(metadata)
    const tree = Array.isArray(rawBalances) ? rawBalances : []

    const body = { data: tree }
    await cacheSet(cacheKey, body, 5 * 60) // 5 мин
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения складских остатков:", error)

    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"

    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
