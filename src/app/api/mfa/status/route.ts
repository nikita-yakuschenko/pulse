import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMfaCookieValid } from "@/lib/mfa-cookie"
import { getJwtIat, SESSION_MAX_AGE_SEC } from "@/lib/jwt-iat"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ needsMfa: false, method: null })
  }

  // Принудительный разрыв сессии раз в 3 месяца (токен из сессии только для iat)
  const { data: { session } } = await supabase.auth.getSession()
  const iat = session?.access_token ? getJwtIat(session.access_token) : null
  if (iat !== null && Math.floor(Date.now() / 1000) - iat > SESSION_MAX_AGE_SEC) {
    return NextResponse.json({ needsReLogin: true })
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const metadata = (user.user_metadata || {}) as Record<string, unknown>
  const mfaMethod = metadata.mfa_method as "totp" | "email" | "telegram" | undefined

  // Supabase TOTP: нужна верификация или повторная верификация через неделю (cookie)
  if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") {
    return NextResponse.json({ needsMfa: true, method: "totp" })
  }
  if (aal?.currentLevel === "aal2" && mfaMethod !== "email" && mfaMethod !== "telegram") {
    const cookieOk = await isMfaCookieValid(user.id)
    if (!cookieOk) {
      return NextResponse.json({ needsMfa: true, method: "totp" })
    }
  }

  // Custom (email/telegram): проверка cookie (1 неделя)
  if (mfaMethod === "email" || mfaMethod === "telegram") {
    const ok = await isMfaCookieValid(user.id)
    if (!ok) {
      return NextResponse.json({
        needsMfa: true,
        method: mfaMethod,
        telegramPhone: metadata.mfa_telegram_phone,
      })
    }
  }

  return NextResponse.json({ needsMfa: false, method: null })
}
