import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMaterials } from "@/integrations/1c"

/** In-memory кэш дерева номенклатуры (одинаково для всех пользователей одной 1С) */
let materialsCache: { data: unknown; ts: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут

/**
 * GET /api/1c/materials
 * Дерево номенклатуры (материалов) из 1С materials/get/list
 * Кэшируется на 5 минут в памяти сервера.
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

    // Отдаём из кэша, если он свежий
    if (materialsCache && Date.now() - materialsCache.ts < CACHE_TTL_MS) {
      return NextResponse.json({ data: materialsCache.data })
    }

    const data = await getMaterials(metadata)
    const result = Array.isArray(data) ? data : (data ?? [])

    // Сохраняем в кэш
    materialsCache = { data: result, ts: Date.now() }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("Ошибка получения номенклатуры (материалов):", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
