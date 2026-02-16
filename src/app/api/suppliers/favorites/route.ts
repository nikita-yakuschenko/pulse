import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type FavoriteSupplierRow = {
  id: string
  user_id: string
  supplier_code: string
  supplier_name: string | null
  payload: Record<string, unknown>
  created_at: string
}

/** GET — список избранных поставщиков текущего пользователя из своей БД */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("favorite_suppliers")
    .select("id, supplier_code, supplier_name, payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    const msg = error.message || ""
    const hint = msg.includes("does not exist") || msg.includes("relation")
      ? " Выполните миграцию: prisma/supabase-favorite-suppliers.sql в SQL Editor Supabase."
      : ""
    return NextResponse.json(
      { error: msg + hint },
      { status: msg.includes("does not exist") ? 503 : 500 }
    )
  }

  return NextResponse.json({ data: data ?? [] })
}

/** POST — добавить поставщика в избранное. Тело: { supplier_code, supplier_name?, ...остальные поля в payload } */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Неверное тело запроса." }, { status: 400 })
  }

  const supplier_code = body.supplier_code != null ? String(body.supplier_code).trim() : ""
  if (!supplier_code) {
    return NextResponse.json({ error: "Укажите supplier_code." }, { status: 400 })
  }

  const { supplier_code: _c, supplier_name, ...rest } = body
  const payload = typeof rest === "object" && rest !== null ? rest : {}
  const supplier_name_val = supplier_name != null ? String(supplier_name) : null

  const { data: row, error } = await supabase
    .from("favorite_suppliers")
    .upsert(
      {
        user_id: user.id,
        supplier_code,
        supplier_name: supplier_name_val,
        payload,
      },
      { onConflict: "user_id,supplier_code" }
    )
    .select("id, supplier_code, supplier_name, payload, created_at")
    .single()

  if (error) {
    const msg = error.message || ""
    const hint = msg.includes("does not exist") || msg.includes("relation")
      ? " Выполните миграцию: prisma/supabase-favorite-suppliers.sql в SQL Editor Supabase."
      : ""
    return NextResponse.json(
      { error: msg + hint },
      { status: msg.includes("does not exist") ? 503 : 500 }
    )
  }

  return NextResponse.json(row)
}

/** DELETE — убрать из избранного. Query: ?code=КодПоставщика */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  const code = request.nextUrl.searchParams.get("code")?.trim()
  if (!code) {
    return NextResponse.json({ error: "Укажите code в query." }, { status: 400 })
  }

  const { error } = await supabase
    .from("favorite_suppliers")
    .delete()
    .eq("user_id", user.id)
    .eq("supplier_code", code)

  if (error) {
    const msg = error.message || ""
    const hint = msg.includes("does not exist") || msg.includes("relation")
      ? " Выполните миграцию: prisma/supabase-favorite-suppliers.sql в SQL Editor Supabase."
      : ""
    return NextResponse.json(
      { error: msg + hint },
      { status: msg.includes("does not exist") ? 503 : 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
