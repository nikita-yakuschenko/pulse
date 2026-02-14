import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDemandByCode } from "@/integrations/1c"

/**
 * GET /api/1c/warehouse/demands/[code]
 * Детали требования-накладной по номеру из 1С demands/get/code/{code}.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code?.trim()) {
      return NextResponse.json({ error: "Номер не указан" }, { status: 400 })
    }

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

    const data = await getDemandByCode(metadata, code.trim())
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Ошибка получения требования-накладной по коду:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
