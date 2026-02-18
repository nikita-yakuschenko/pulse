import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/project-catalog — типовые проекты для селекта */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    const { data: list, error } = await supabase.from("project_catalog").select("id, name").order("name", { ascending: true })
    if (error) {
      console.error("[GET /api/construction/project-catalog]", error)
      return NextResponse.json({ error: "Ошибка загрузки проектов" }, { status: 500 })
    }
    return NextResponse.json((list ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
  } catch (e) {
    console.error("[GET /api/construction/project-catalog]", e)
    return NextResponse.json({ error: "Ошибка загрузки проектов" }, { status: 500 })
  }
}
