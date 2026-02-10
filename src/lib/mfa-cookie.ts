import { cookies } from "next/headers"
import { createHmac } from "crypto"

export const MFA_COOKIE_NAME = "mfa_verified"
const COOKIE_NAME = MFA_COOKIE_NAME

/** Срок доверия устройства после 2FA: 1 неделя (в секундах). */
export const MFA_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60

export function getMfaCookieSecret() {
  const secret = process.env.MFA_COOKIE_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("MFA_COOKIE_SECRET (или NEXTAUTH_SECRET) должен быть задан в production")
  }
  return secret || "mfa-secret-change-me"
}

/** Подпись cookie: payload userId:expiresAt. */
export function signMfaCookie(userId: string, expiresAt: number): string {
  const payload = `${userId}:${expiresAt}`
  const signature = createHmac("sha256", getMfaCookieSecret()).update(payload).digest("hex")
  return `${payload}.${signature}`
}

export async function isMfaCookieValid(userId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return false
  const parts = raw.split(".")
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  const [id, expStr] = payload.split(":")
  const exp = parseInt(expStr, 10)
  if (id !== userId || isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = createHmac("sha256", getMfaCookieSecret())
    .update(payload)
    .digest("hex")
  return signature === expected
}
