import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const CODE_EXPIRY_MINUTES = 5

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const method = body.method as "email" | "telegram"
  const telegramPhone = body.telegramPhone as string | undefined

  if (method === "email") {
    if (!resend) {
      return NextResponse.json(
        { error: "Email not configured. Set RESEND_API_KEY." },
        { status: 503 }
      )
    }
    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)
    const { error: dbError } = await supabase
      .from("mfa_code")
      .insert({
        id: randomUUID(),
        userId: user.id,
        code,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      })
    
    if (dbError) {
      console.error("[MFA send-code] DB error:", dbError)
      return NextResponse.json({ error: "Failed to save code" }, { status: 500 })
    }
    
    const from = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev"
    const { error } = await resend.emails.send({
      from,
      to: user.email!,
      subject: "Код подтверждения 2FA — Модуль.Пульс",
      text: `Ваш код: ${code}. Действует ${CODE_EXPIRY_MINUTES} минут.`,
      html: `<p>Ваш код: <strong>${code}</strong></p><p>Действует ${CODE_EXPIRY_MINUTES} минут.</p>`,
    })
    if (error) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }
  } else if (method === "telegram") {
    const token = process.env.TELEGRAM_GATEWAY_TOKEN
    if (!token || !telegramPhone) {
      return NextResponse.json(
        { error: "Telegram not configured or phone required." },
        { status: 503 }
      )
    }
    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)
    const { error: dbError } = await supabase
      .from("mfa_code")
      .insert({
        id: randomUUID(),
        userId: user.id,
        code,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      })
    
    if (dbError) {
      console.error("[MFA send-code] DB error:", dbError)
      return NextResponse.json({ error: "Failed to save code" }, { status: 500 })
    }
    
    const phone = telegramPhone.replace(/\D/g, "")
    const res = await fetch("https://gatewayapi.telegram.org/sendVerificationMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        phone_number: phone.startsWith("+") ? phone : `+${phone}`,
        code,
        ttl: CODE_EXPIRY_MINUTES * 60,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: "Failed to send to Telegram" }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
