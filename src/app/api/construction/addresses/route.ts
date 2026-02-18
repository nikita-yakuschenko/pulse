import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/addresses — список для фильтра (по fullText/locality) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const q = new URL(request.url).searchParams.get("q")?.trim()
    let query = supabase.from("address").select("id, region, district, locality, street, house, fullText").order("fullText", { ascending: true }).limit(200)
    if (q) {
      query = query.or(`fullText.ilike.%${q}%,locality.ilike.%${q}%,region.ilike.%${q}%`)
    }
    const { data: list, error } = await query
    if (error) {
      console.error("[GET /api/construction/addresses]", error)
      return NextResponse.json({ error: "Ошибка загрузки адресов" }, { status: 500 })
    }

    const items = (list ?? []).map((a: Record<string, unknown>) => {
      const fullText = a.fullText as string | null
      const region = a.region as string | null
      const district = a.district as string | null
      const locality = a.locality as string | null
      const street = a.street as string | null
      const house = a.house as string | null
      return {
        id: a.id,
        region,
        district,
        locality,
        street,
        house,
        fullText,
        displayFull: fullText?.trim() || [region, district, locality, street, house].filter(Boolean).join(", ") || null,
      }
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error("[GET /api/construction/addresses]", e)
    return NextResponse.json({ error: "Ошибка загрузки адресов" }, { status: 500 })
  }
}

/** POST /api/construction/addresses — создание адреса */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const { data: addr, error } = await supabase
      .from("address")
      .insert({
        region: (body.region as string) || undefined,
        district: (body.district as string) || undefined,
        locality: (body.locality as string) || undefined,
        street: (body.street as string) || undefined,
        house: (body.house as string) || undefined,
        fullText: (body.fullText as string) || undefined,
        kladrCode: (body.kladrCode as string) || undefined,
        fiasId: (body.fiasId as string) || undefined,
        isCustom: body.isCustom === true,
        updatedAt: new Date().toISOString(),
      })
      .select("id, region, district, locality, street, house, fullText")
      .single()
    if (error || !addr) {
      console.error("[POST /api/construction/addresses]", error)
      return NextResponse.json({ error: "Ошибка создания адреса" }, { status: 500 })
    }
    const a = addr as Record<string, unknown>
    const fullText = a.fullText as string | null
    const region = a.region as string | null
    const district = a.district as string | null
    const locality = a.locality as string | null
    const street = a.street as string | null
    const house = a.house as string | null
    return NextResponse.json({
      id: a.id,
      region,
      district,
      locality,
      street,
      house,
      fullText,
      displayFull: fullText?.trim() || [region, district, locality, street, house].filter(Boolean).join(", ") || null,
    })
  } catch (e) {
    console.error("[POST /api/construction/addresses]", e)
    return NextResponse.json({ error: "Ошибка создания адреса" }, { status: 500 })
  }
}
