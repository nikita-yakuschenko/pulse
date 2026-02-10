"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"

const METHOD_LABELS: Record<string, string> = {
  totp: "приложения Google Authenticator или другого TOTP-приложения",
  email: "письма на вашу почту",
  telegram: "Telegram (бот @VerificationCodes)",
}

export function MfaVerifyForm({
  method,
  telegramPhone,
  onSuccess,
}: {
  method: "totp" | "email" | "telegram"
  telegramPhone?: string
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(method !== "totp" ? false : true)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetPassword, setResetPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSendCode() {
    if (method === "totp") return
    setSending(true)
    try {
      const res = await fetch("/api/mfa/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          ...(method === "telegram" && telegramPhone
            ? { telegramPhone }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось отправить код.")
        return
      }
      setSent(true)
      toast.success("Код отправлен.")
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = code.replace(/\D/g, "").slice(0, 6)
    if (trimmed.length !== 6) {
      toast.error("Введите 6-значный код.")
      return
    }
    if (method === "totp") {
      const supabase = createClient()
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) {
        toast.error("Ошибка: фактор 2FA не найден.")
        return
      }
      const { data: challenge, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challengeErr) {
        toast.error("Не удалось войти. Попробуйте снова.")
        return
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: trimmed,
      })
      if (verifyErr) {
        toast.error("Неверный код. Проверьте и попробуйте снова.")
        return
      }
      await fetch("/api/mfa/set-verified-cookie", { method: "POST" })
    } else {
      const res = await fetch("/api/mfa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Неверный код.")
        return
      }
    }
    toast.success("Вход выполнен.")
    setCode("")
    onSuccess?.()
    router.refresh()
  }

  async function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = resetEmail.trim()
    const password = resetPassword
    if (!email || !password) {
      toast.error("Введите email и пароль.")
      return
    }
    setResetLoading(true)
    try {
      const res = await fetch("/api/mfa/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось сбросить 2FA.")
        return
      }
      toast.success("2FA сброшена. Обновите страницу.")
      setShowReset(false)
      setResetEmail("")
      setResetPassword("")
      onSuccess?.()
      router.refresh()
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-md min-h-[40vh] items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-sm min-w-[280px] shrink-0">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="text-center">
                <h2 className="text-lg font-semibold">Двухфакторная аутентификация</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Введите код из {METHOD_LABELS[method] || "приложения"}
                </p>
                {method === "telegram" && telegramPhone && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    На номер {telegramPhone}
                  </p>
                )}
              </div>
              {method !== "totp" && !sent && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSendCode}
                  disabled={sending}
                >
                  {sending ? "Отправка…" : "Отправить код"}
                </Button>
              )}
              {method !== "totp" && sent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground -mt-2"
                  onClick={handleSendCode}
                  disabled={sending}
                >
                  Отправить повторно
                </Button>
              )}
              <Field>
                <FieldLabel htmlFor="mfa-code" className="sr-only">
                  Код подтверждения
                </FieldLabel>
                <InputOTP
                  id="mfa-code"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-center gap-2 flex-nowrap shrink-0"
                >
                  <InputOTPGroup className="gap-2 shrink-0">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator className="shrink-0" />
                  <InputOTPGroup className="gap-2 shrink-0">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription className="text-center">
                  6 цифр из приложения или письма
                </FieldDescription>
              </Field>
              <Button type="submit" className="w-full">
                Подтвердить
              </Button>
              <div className="border-t pt-4 mt-2">
                <button
                  type="button"
                  className="text-muted-foreground text-xs hover:underline"
                  onClick={() => setShowReset((v) => !v)}
                >
                  {showReset ? "Скрыть" : "Потеряли доступ к приложению? Сбросить 2FA"}
                </button>
                {showReset && (
                  <form onSubmit={handleResetSubmit} className="mt-3 space-y-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      autoComplete="email"
                      className="h-9 text-sm"
                    />
                    <Input
                      type="password"
                      placeholder="Пароль"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-9 text-sm"
                    />
                    <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={resetLoading}>
                      {resetLoading ? "Сброс…" : "Сбросить 2FA"}
                    </Button>
                  </form>
                )}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
