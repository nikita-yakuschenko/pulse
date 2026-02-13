import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getReceipts, type ReceiptsFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/receipts
 * Получает список поступлений из 1С. Кэш в Redis.
 * Query: code, year, contractor, org, material, full
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
    const filters: ReceiptsFilters = {}

    const code = searchParams.get("code")
    const year = searchParams.get("year")
    const contractor = searchParams.get("contractor")
    const org = searchParams.get("org")
    const material = searchParams.get("material")
    const full = searchParams.get("full")

    if (code) filters.code = code
    if (year) filters.year = year
    if (contractor) filters.contractor = contractor
    if (org) filters.org = org
    if (material) filters.material = material
    if (full === "1" || full === "true") filters.full = true

    const cacheKey = buildCacheKey("1c:receipts", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown; filters: ReceiptsFilters }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const raw = await getReceipts(metadata, filters)
    // 1С возвращает { data: [...] }; если пришёл массив — используем как есть
    const data = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [])
    const body = { data, filters }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения поступлений:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
