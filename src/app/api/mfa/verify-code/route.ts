import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { MFA_COOKIE_MAX_AGE_SEC, MFA_COOKIE_NAME, signMfaCookie } from "@/lib/mfa-cookie"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const code = String(body.code || "").replace(/\s/g, "").trim()
  const isEnroll = body.enroll === true
  if (code.length !== 6) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const { data: records, error: fetchError } = await supabase
    .from("mfa_code")
    .select("*")
    .eq("userId", user.id)
    .eq("code", code)
    .gt("expiresAt", new Date().toISOString())
    .order("createdAt", { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error("[MFA verify-code] Fetch error:", fetchError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const record = records && records.length > 0 ? records[0] : null

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 })
  }

  // Удаляем все коды пользователя
  const { error: deleteError } = await supabase
    .from("mfa_code")
    .delete()
    .eq("userId", user.id)
  
  if (deleteError) {
    console.error("[MFA verify-code] Delete error:", deleteError)
  }

  if (isEnroll) {
    const method = body.method as "email" | "telegram"
    await supabase.auth.updateUser({
      data: {
        mfa_method: method,
        ...(method === "telegram" && body.telegramPhone
          ? { mfa_telegram_phone: body.telegramPhone }
          : {}),
      },
    })
  } else {
    const expiresAt = Math.floor(Date.now() / 1000) + MFA_COOKIE_MAX_AGE_SEC
    const cookieValue = signMfaCookie(user.id, expiresAt)
    const cookieStore = await cookies()
    cookieStore.set(MFA_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MFA_COOKIE_MAX_AGE_SEC,
      path: "/",
    })
  }

  return NextResponse.json({ ok: true })
}
