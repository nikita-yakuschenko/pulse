import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DADATA_SUGGEST_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"

/** GET /api/construction/addresses/suggest?q= — подсказки адресов из DaData (при создании объекта). Дальше адрес хранится в нашей БД. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const apiKey = process.env.DA_DATA_API_KEY
    const secretKey = process.env.DA_DATA_SECRET_KEY
    if (!apiKey?.trim() || !secretKey?.trim()) {
      return NextResponse.json(
        { error: "DaData ключи не настроены (DA_DATA_API_KEY, DA_DATA_SECRET_KEY)" },
        { status: 503 }
      )
    }

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
    const res = await fetch(DADATA_SUGGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
        "X-Secret": secretKey,
      },
      body: JSON.stringify({ query: q, count: 20 }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[GET /api/construction/addresses/suggest] DaData error:", res.status, text)
      return NextResponse.json({ error: "Ошибка подсказок адресов" }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ suggestions: data.suggestions ?? [] })
  } catch (e) {
    console.error("[GET /api/construction/addresses/suggest]", e)
    return NextResponse.json({ error: "Ошибка подсказок адресов" }, { status: 500 })
  }
}
