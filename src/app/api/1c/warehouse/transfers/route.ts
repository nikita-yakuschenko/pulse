import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTransfersList, getTransferByCodeFull } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/warehouse/transfers
 * Список перемещений из 1С. Кэш в Redis (список). Query: code, year, full — как в заказах поставщика (code + year + full=1 для детали).
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code") ?? undefined
    const year = searchParams.get("year") ?? undefined
    const full = searchParams.get("full")

    if (full === "1" || full === "true") {
      if (!code?.trim()) {
        return NextResponse.json({ error: "full=1 требует code" }, { status: 400 })
      }
      const result = await getTransferByCodeFull(metadata, code.trim(), year?.trim())
      return NextResponse.json(result)
    }

    const cacheKey = buildCacheKey("1c:warehouse:transfers", user.id, { code: code ?? "" })
    const cached = await cacheGet<{ data: unknown[] }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const data = await getTransfersList(metadata, { code })
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
