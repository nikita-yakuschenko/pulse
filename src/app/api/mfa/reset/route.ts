import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Неверный запрос." }, { status: 400 })
  }
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  if (!email || !password) {
    return NextResponse.json({ error: "Укажите email и пароль." }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Сервер не настроен." }, { status: 500 })
  }
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Сброс 2FA недоступен: не задан SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    )
  }

  // Проверяем личность: вход по паролю (без cookies, чтобы не трогать текущую сессию)
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signInData?.user?.id) {
    return NextResponse.json(
      { error: "Неверный email или пароль." },
      { status: 401 }
    )
  }
  const userId = signInData.user.id

  try {
    const admin = createAdminClient()
    const { data: factorsData, error: listErr } = await admin.auth.admin.mfa.listFactors({
      userId,
    })
    if (listErr) {
      return NextResponse.json(
        { error: "Не удалось получить данные 2FA." },
        { status: 500 }
      )
    }

    // Admin listFactors возвращает { factors: Factor[] }, не totp/all
    const raw = factorsData as { factors?: Array<{ id: string }>; totp?: Array<{ id: string }>; all?: Array<{ id: string }> } | undefined
    const factors = raw?.factors ?? raw?.totp ?? raw?.all ?? []
    for (const factor of factors) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId,
      })
      if (delErr) {
        console.error("MFA reset: deleteFactor failed", factor.id, delErr)
      }
    }

    const currentMeta = (signInData.user.user_metadata || {}) as Record<string, unknown>
    const { mfa_method: _m, mfa_telegram_phone: _t, ...rest } = currentMeta
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...rest, mfa_method: null, mfa_telegram_phone: null },
    })
  } catch (e) {
    console.error("MFA reset error", e)
    return NextResponse.json(
      { error: "Не удалось сбросить 2FA." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
