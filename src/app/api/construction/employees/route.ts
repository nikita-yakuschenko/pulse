import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/employees — прорабы для селекта */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    const { data: list, error } = await supabase.from("employee").select("id, name").order("name", { ascending: true })
    if (error) {
      console.error("[GET /api/construction/employees]", error)
      return NextResponse.json({ error: "Ошибка загрузки прорабов" }, { status: 500 })
    }
    return NextResponse.json((list ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })))
  } catch (e) {
    console.error("[GET /api/construction/employees]", e)
    return NextResponse.json({ error: "Ошибка загрузки прорабов" }, { status: 500 })
  }
}
