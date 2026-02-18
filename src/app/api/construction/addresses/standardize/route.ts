import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DADATA_CLEAN_URL = "https://cleaner.dadata.ru/api/v1/clean/address"

/** POST /api/construction/addresses/standardize — прокси к DaData clean (стандартизация одной строки) */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const query = Array.isArray(body) ? body[0] : (body?.query ?? body?.address ?? "")
    if (typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Укажите адрес (query или address)" }, { status: 400 })
    }

    const res = await fetch(DADATA_CLEAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
        "X-Secret": secretKey,
      },
      body: JSON.stringify([query.trim()]),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[POST /api/construction/addresses/standardize] DaData error:", res.status, text)
      return NextResponse.json(
        { error: "Ошибка сервиса стандартизации адреса" },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error("[POST /api/construction/addresses/standardize]", e)
    return NextResponse.json(
      { error: "Ошибка запроса стандартизации адреса" },
      { status: 500 }
    )
  }
}
