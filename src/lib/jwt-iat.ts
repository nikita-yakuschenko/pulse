/**
 * Извлекает iat (issued at) из JWT без проверки подписи.
 * Используется только для проверки возраста сессии после того, как сессия уже получена через Supabase.
 */
export function getJwtIat(accessToken: string): number | null {
  try {
    const parts = accessToken.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { iat?: number }
    return typeof payload.iat === "number" ? payload.iat : null
  } catch {
    return null
  }
}

/** Максимальный возраст сессии: 3 месяца (в секундах). */
export const SESSION_MAX_AGE_SEC = 90 * 24 * 60 * 60
