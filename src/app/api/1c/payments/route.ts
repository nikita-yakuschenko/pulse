import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPayments, type PaymentsFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/payments
 * Список платежей из 1С. Кэш в Redis.
 * Query: from, to (dd.MM.yyyy), code, contractor, org, responsible, status, full. Обратная совместимость: year → from/to.
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
    const filters: PaymentsFilters = {}

    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const year = searchParams.get("year")
    const code = searchParams.get("code")
    const contractor = searchParams.get("contractor")
    const org = searchParams.get("org")
    const responsible = searchParams.get("responsible")
    const status = searchParams.get("status")
    const full = searchParams.get("full")

    if (from) filters.from = from
    if (to) filters.to = to
    if (year && !filters.from && !filters.to) {
      const y = year.trim().slice(-2)
      filters.from = `01.01.${y.length === 2 ? `20${y}` : year}`
      filters.to = `31.12.${y.length === 2 ? `20${y}` : year}`
    }
    if (code) filters.code = code
    if (contractor) filters.contractor = contractor
    if (org) filters.org = org
    if (responsible) filters.responsible = responsible
    if (status) filters.status = status
    const fullVal = searchParams.get("full")
    if (fullVal === "1" || fullVal === "true" || fullVal === "yes" || (fullVal && fullVal.toLowerCase() === "full")) filters.full = "true"

    const cacheKey = buildCacheKey("1c:payments", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown; filters: PaymentsFilters }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const payments = await getPayments(metadata, filters)
    const body = { data: payments, filters }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения платежей:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
