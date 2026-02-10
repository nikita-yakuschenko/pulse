import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { MFA_COOKIE_MAX_AGE_SEC, MFA_COOKIE_NAME, signMfaCookie } from "@/lib/mfa-cookie"

/**
 * Устанавливает cookie "устройство прошло 2FA" после успешной верификации TOTP на клиенте.
 * Вызывается из MfaVerifyForm после supabase.auth.mfa.verify().
 * Срок доверия: 1 неделя (повторный запрос кода после недели или новое устройство).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== "aal2") {
    return NextResponse.json(
      { error: "2FA ещё не пройдена в этой сессии." },
      { status: 400 }
    )
  }

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

  return NextResponse.json({ ok: true })
}
