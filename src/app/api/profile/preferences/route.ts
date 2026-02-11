import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type UserPreferences = Record<string, string | number | boolean>

/** GET — вернуть настройки текущего пользователя */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const preferences: UserPreferences = (data?.preferences as UserPreferences) ?? {}
  return NextResponse.json(preferences)
}

/** PATCH — обновить настройки (слияние с существующими) */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  let body: UserPreferences
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Неверное тело запроса." }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const current = (existing?.preferences as UserPreferences) ?? {}
  const merged = { ...current, ...body }

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, preferences: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(merged)
}
