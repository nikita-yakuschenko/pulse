import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSuppliers, type SuppliersFilters } from "@/integrations/1c"
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/redis"

const CACHE_TTL_SEC = 5 * 60 // 5 минут

/**
 * GET /api/1c/suppliers
 * Список поставщиков из 1С.
 * Query: inn — по ИНН, name — по наименованию (вхождение).
 * Endpoints: suppliers/get/list | get/inn/{x} | get/name/{x} | get/name/{x}/inn/{y}
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
    const filters: SuppliersFilters = {}
    const inn = searchParams.get("inn")?.trim()
    const name = searchParams.get("name")?.trim()
    if (inn) filters.inn = inn
    if (name) filters.name = name

    const cacheKey = buildCacheKey("1c:suppliers", user.id, filters as Record<string, string>)
    const cached = await cacheGet<{ data: unknown[] }>(cacheKey)
    if (cached != null) {
      return NextResponse.json(cached)
    }

    const data = await getSuppliers(metadata, Object.keys(filters).length > 0 ? filters : undefined)
    const body = { data: Array.isArray(data) ? data : [] }
    await cacheSet(cacheKey, body, CACHE_TTL_SEC)
    return NextResponse.json(body)
  } catch (error) {
    console.error("Ошибка получения поставщиков:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
