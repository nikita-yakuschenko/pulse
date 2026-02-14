import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDemandsList } from "@/integrations/1c"

/**
 * GET /api/1c/warehouse/demands
 * Список требований-накладных (реализации) из 1С demands/get/list.
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
    const oneC = integrations?.["1c"] as { enabled?: boolean } | undefined

    if (!oneC?.enabled) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена. Настройте в разделе Настройки → Интеграции." },
        { status: 400 }
      )
    }

    const data = await getDemandsList(metadata)
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Ошибка получения требований-накладных:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
