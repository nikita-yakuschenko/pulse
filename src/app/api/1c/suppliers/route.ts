import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/1c/suppliers
 * Список поставщиков из 1С. Пока заглушка: возвращает пустой массив.
 * Когда будет готова интеграция 1С (справочник контрагентов) — подставить вызов getSuppliers(metadata).
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

    // Заглушка: справочник поставщиков из 1С будет подключён позже
    const data: unknown[] = []
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Ошибка получения поставщиков:", error)
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось получить данные: ${errorMessage}` },
      { status: 500 }
    )
  }
}
