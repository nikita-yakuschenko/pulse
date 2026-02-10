import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPayments, type PaymentsFilters } from "@/integrations/1c"

/**
 * GET /api/1c/payments
 * Получает список платежей (оплат) из 1С
 * 
 * Query параметры:
 * - code: номер платежа
 * - contractor: контрагент
 * - year: год в коротком формате (24, 25, 26)
 * - org: организация
 * - responsible: ответственный
 * - status: статус
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const metadata = user.user_metadata || {}
    
    // Проверяем, настроена ли интеграция 1С
    const integrations = metadata.integrations as Record<string, unknown> | undefined
    const oneC = integrations?.["1c"] as { enabled: boolean } | undefined
    
    if (!oneC?.enabled) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена. Настройте в разделе Настройки → Интеграции." },
        { status: 400 }
      )
    }

    // Извлекаем параметры фильтрации из query string
    const searchParams = request.nextUrl.searchParams
    const filters: PaymentsFilters = {}
    
    const code = searchParams.get("code")
    const contractor = searchParams.get("contractor")
    const year = searchParams.get("year")
    const org = searchParams.get("org")
    const responsible = searchParams.get("responsible")
    const status = searchParams.get("status")
    const full = searchParams.get("full")
    
    if (code) filters.code = code
    if (contractor) filters.contractor = contractor
    if (year) filters.year = year
    if (org) filters.org = org
    if (responsible) filters.responsible = responsible
    if (status) filters.status = status
    if (full) filters.full = full

    // Получаем данные из 1С
    const payments = await getPayments(metadata, filters)

    return NextResponse.json({ data: payments, filters })
  } catch (error) {
    console.error("Ошибка получения платежей:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
