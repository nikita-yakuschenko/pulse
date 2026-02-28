import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTransfersList, getTransferByCodeFull, type TransfersFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/warehouse/transfers
 * Список перемещений из 1С. Query: from, to (dd.MM.yyyy), code, full. Для full=1 — code обязателен; year (обратная совместимость) конвертируется в from/to внутри интеграции.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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
    const code = searchParams.get("code") ?? undefined
    const from = searchParams.get("from")?.trim()
    const to = searchParams.get("to")?.trim()
    const year = searchParams.get("year") ?? undefined
    const full = searchParams.get("full")

    if (full === "1" || full === "true" || full === "yes" || (full && full.toLowerCase() === "full")) {
      if (!code?.trim()) {
        return NextResponse.json({ error: "full=true требует code" }, { status: 400 })
      }
      const result = await getTransferByCodeFull(metadata, code.trim(), year?.trim())
      return NextResponse.json(result)
    }

    const filters: TransfersFilters = {}
    if (code?.trim()) filters.code = code.trim()
    if (from) filters.from = from
    if (to) filters.to = to
    if (year && !filters.from && !filters.to) {
      const y = year.trim().slice(-2)
      filters.from = `01.01.${y.length === 2 ? `20${y}` : year}`
      filters.to = `31.12.${y.length === 2 ? `20${y}` : year}`
    }

    const cacheKey = buildCacheKey("1c:warehouse:transfers", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown[] }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const data = await getTransfersList(metadata, Object.keys(filters).length > 0 ? filters : undefined)
    const body = { data }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения перемещений:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
