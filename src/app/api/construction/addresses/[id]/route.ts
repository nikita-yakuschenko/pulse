import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/addresses/[id] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    const { id } = await params
    const { data: addr, error } = await supabase.from("address").select("id, region, district, locality, street, house, fullText").eq("id", id).single()
    if (error || !addr) return NextResponse.json({ error: "Адрес не найден" }, { status: 404 })
    const a = addr as Record<string, unknown>
    const fullText = a.fullText as string | null
    const displayFull = fullText?.trim() || [a.region, a.district, a.locality, a.street, a.house].filter(Boolean).join(", ") || null
    return NextResponse.json({ id: a.id, region: a.region, district: a.district, locality: a.locality, street: a.street, house: a.house, fullText: a.fullText, displayFull })
  } catch (e) {
    console.error("[GET /api/construction/addresses/[id]]", e)
    return NextResponse.json({ error: "Ошибка загрузки адреса" }, { status: 500 })
  }
}
