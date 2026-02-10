import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupplierOrders, type SordersFilters } from "@/integrations/1c"

/**
 * GET /api/1c/supplier-orders
 * Получает список заказов поставщикам из 1С
 * 
 * Query параметры:
 * - code: номер заказа (поиск по вхождению)
 * - contractor: контрагент (поиск по вхождению)
 * - year: год в коротком формате (24, 25, 26)
 * - full: 1 или true для полной информации с табличной частью
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
    const filters: SordersFilters = {}
    
    const code = searchParams.get("code")
    const contractor = searchParams.get("contractor")
    const year = searchParams.get("year")
    const full = searchParams.get("full")
    
    if (code) filters.code = code
    if (contractor) filters.contractor = contractor
    if (year) filters.year = year
    if (full === "1" || full === "true") filters.full = true

    // Получаем данные из 1С
    const orders = await getSupplierOrders(metadata, filters)

    return NextResponse.json({ data: orders, filters })
  } catch (error) {
    console.error("Ошибка получения заказов поставщикам:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
    
    return NextResponse.json(
      { error: `Не удалось получить данные из 1С: ${errorMessage}` },
      { status: 500 }
    )
  }
}
