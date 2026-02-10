"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { IconBrandTelegram, IconMail, IconShieldCheck } from "@tabler/icons-react"

export type MfaMethod = "totp" | "email" | "telegram"

type MfaState = "select" | "enrolling" | "enrolled" | "loading"

const METHOD_OPTIONS: { id: MfaMethod; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "totp", label: "Google Authenticator", desc: "TOTP-приложение (Authy, 1Password и др.)", icon: IconShieldCheck },
  { id: "email", label: "Код на почту", desc: "Одноразовый код на вашу электронную почту", icon: IconMail },
  { id: "telegram", label: "Telegram", desc: "Код в Telegram (@VerificationCodes)", icon: IconBrandTelegram },
]

export function MfaSettings() {
  const [state, setState] = useState<MfaState>("loading")
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod | null>(null)
  const [factorId, setFactorId] = useState("")
  const [qrSvg, setQrSvg] = useState("")
  const [secret, setSecret] = useState("")
  const [code, setCode] = useState("")
  const [telegramPhone, setTelegramPhone] = useState("")
  const [sending, setSending] = useState(false)
  const [currentMethod, setCurrentMethod] = useState<MfaMethod | null>(null)
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false)
  const [unenrollCode, setUnenrollCode] = useState("")
  const [unenrollConfirmStep, setUnenrollConfirmStep] = useState(0)

  async function loadState() {
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const metadata = (await supabase.auth.getUser()).data.user?.user_metadata as Record<string, unknown> | undefined
    const metaMethod = metadata?.mfa_method as MfaMethod | undefined
    const hasTotp =
      (factors as { totp?: unknown[]; all?: Array<{ factor_type: string }> } | undefined)?.totp?.length ||
      (factors as { all?: Array<{ factor_type: string }> } | undefined)?.all?.some((f) => f.factor_type === "totp")
    if (hasTotp) {
      setState("enrolled")
      setCurrentMethod("totp")
    } else if (metaMethod === "email" || metaMethod === "telegram") {
      setState("enrolled")
      setCurrentMethod(metaMethod)
    } else {
      setState("select")
    }
  }

  useEffect(() => {
    loadState()
  }, [])

  async function handleSelectMethod(method: MfaMethod) {
    setSelectedMethod(method)
    setCode("")
    setTelegramPhone("")
    if (method === "totp") {
      setState("enrolling")
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Google Authenticator",
      })
      if (error) {
        if (error.message?.includes("already exists") || (error as { code?: string }).code === "mfa_factor_name_conflict") {
          toast.info("2FA (Google Authenticator) уже включена для этого аккаунта.")
          setState("enrolled")
          setCurrentMethod("totp")
          setSelectedMethod(null)
          return
        }
        toast.error("Не удалось начать настройку 2FA.")
        setState("select")
        setSelectedMethod(null)
        return
      }
      setFactorId(data.id)
      setQrSvg(data.totp.qr_code)
      setSecret(data.totp.secret)
    } else {
      setState("enrolling")
    }
  }

  async function handleSendEnrollCode() {
    if (!selectedMethod || (selectedMethod === "telegram" && !telegramPhone.trim())) {
      if (selectedMethod === "telegram") toast.error("Введите номер телефона.")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/mfa/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          ...(selectedMethod === "telegram" ? { telegramPhone: telegramPhone.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось отправить код.")
        return
      }
      toast.success("Код отправлен.")
    } finally {
      setSending(false)
    }
  }

  async function handleEnrollVerify(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.replace(/\D/g, "").slice(0, 6)
    if (trimmed.length !== 6) {
      toast.error("Введите 6-значный код.")
      return
    }
    if (selectedMethod === "totp") {
      const supabase = createClient()
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (chErr) {
        toast.error("Ошибка. Попробуйте снова.")
        return
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: trimmed,
      })
      if (verifyErr) {
        toast.error("Неверный код. Проверьте и попробуйте снова.")
        return
      }
    } else {
      const res = await fetch("/api/mfa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          enroll: true,
          method: selectedMethod,
          ...(selectedMethod === "telegram" ? { telegramPhone: telegramPhone.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Неверный код.")
        return
      }
    }
    toast.success("Двухфакторная аутентификация включена.")
    setState("enrolled")
    setCurrentMethod(selectedMethod!)
    setSelectedMethod(null)
    setFactorId("")
    setQrSvg("")
    setSecret("")
    setCode("")
    setTelegramPhone("")
  }

  function handleUnenrollClick() {
    if (currentMethod === "totp") {
      setShowUnenrollConfirm(true)
      setUnenrollCode("")
    } else {
      if (unenrollConfirmStep === 0) {
        setUnenrollConfirmStep(1)
        return
      }
      doUnenroll()
    }
  }

  function cancelUnenrollConfirm() {
    setShowUnenrollConfirm(false)
    setUnenrollCode("")
    setUnenrollConfirmStep(0)
  }

  async function doUnenroll() {
    if (currentMethod === "totp") {
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      const totpFactor =
        data?.totp?.[0] ??
        (data as { all?: Array<{ id: string; factor_type: string }> } | undefined)?.all?.find(
          (f) => f.factor_type === "totp"
        )
      if (!totpFactor) {
        toast.error("Фактор 2FA не найден.")
        setShowUnenrollConfirm(false)
        return
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id })
      if (error) {
        toast.error("Не удалось отключить 2FA.")
        setShowUnenrollConfirm(false)
        return
      }
    } else {
      const supabase = createClient()
      await supabase.auth.updateUser({
        data: { mfa_method: null, mfa_telegram_phone: null },
      })
    }
    toast.success("Двухфакторная аутентификация отключена.")
    setState("select")
    setCurrentMethod(null)
    setShowUnenrollConfirm(false)
    setUnenrollCode("")
    setUnenrollConfirmStep(0)
  }

  async function handleUnenrollConfirm(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = unenrollCode.replace(/\D/g, "").slice(0, 6)
    if (trimmed.length !== 6) {
      toast.error("Введите 6-значный код из приложения.")
      return
    }
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totpFactor =
      factors?.totp?.[0] ??
      (factors as { all?: Array<{ id: string; factor_type: string }> } | undefined)?.all?.find(
        (f) => f.factor_type === "totp"
      )
    if (!totpFactor) {
      toast.error("Фактор 2FA не найден.")
      setShowUnenrollConfirm(false)
      return
    }
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
    if (chErr) {
      toast.error("Не удалось подтвердить. Попробуйте снова.")
      return
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: trimmed,
    })
    if (verifyErr) {
      toast.error("Неверный код.")
      return
    }
    await doUnenroll()
  }

  function handleCancelEnroll() {
    setState("select")
    setSelectedMethod(null)
    setFactorId("")
    setQrSvg("")
    setSecret("")
    setCode("")
    setTelegramPhone("")
  }

  if (state === "loading") {
    return <div className="text-muted-foreground text-sm">Загрузка...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Двухфакторная аутентификация (2FA)</CardTitle>
        <CardDescription>
          Выберите способ подтверждения при входе
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "enrolled" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">2FA включена</p>
                <p className="text-muted-foreground text-sm">
                  Способ: {METHOD_OPTIONS.find((o) => o.id === currentMethod)?.label ?? currentMethod}
                </p>
              </div>
              {!showUnenrollConfirm && unenrollConfirmStep === 0 && (
                <Button variant="outline" onClick={handleUnenrollClick}>
                  Отключить
                </Button>
              )}
            </div>
            {currentMethod === "totp" && showUnenrollConfirm && (
              <form onSubmit={handleUnenrollConfirm} className="rounded-lg border p-4 space-y-3">
                <p className="text-muted-foreground text-sm">
                  Для отключения 2FA введите текущий код из приложения (подтверждение, что это вы).
                </p>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="unenroll-code" className="sr-only">
                      Код из приложения
                    </FieldLabel>
                    <InputOTP
                      id="unenroll-code"
                      maxLength={6}
                      value={unenrollCode}
                      onChange={setUnenrollCode}
                      containerClassName="justify-center gap-2"
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive">
                      Отключить 2FA
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelUnenrollConfirm}>
                      Отмена
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            )}
            {currentMethod !== "totp" && unenrollConfirmStep === 1 && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-muted-foreground text-sm">
                  Вы уверены, что хотите отключить 2FA? Подтвердите действие.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => doUnenroll()}>
                    Да, отключить 2FA
                  </Button>
                  <Button variant="outline" onClick={cancelUnenrollConfirm}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {state === "select" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectMethod(opt.id)}
                className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <opt.icon className="size-5" />
                <span className="font-medium">{opt.label}</span>
                <span className="text-muted-foreground text-sm">{opt.desc}</span>
              </button>
            ))}
          </div>
        )}

        {state === "enrolling" && selectedMethod === "totp" && (
          <form onSubmit={handleEnrollVerify} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Отсканируйте QR-код в Google Authenticator или другом приложении:
            </p>
            {qrSvg && (
              <div className="inline-block rounded-lg border bg-white p-2 dark:bg-white">
                <img
                  src={qrSvg.startsWith("data:") ? qrSvg : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
                  alt="QR-код для 2FA"
                  width={200}
                  height={200}
                />
              </div>
            )}
            {secret && (
              <p className="text-muted-foreground text-xs font-mono">
                Или введите ключ вручную: {secret}
              </p>
            )}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="enroll-code" className="sr-only">
                  Код из приложения
                </FieldLabel>
                <InputOTP
                  id="enroll-code"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-center gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>
              <div className="flex gap-2">
                <Button type="submit">Включить</Button>
                <Button type="button" variant="outline" onClick={handleCancelEnroll}>
                  Отмена
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}

        {state === "enrolling" && selectedMethod === "email" && (
          <form onSubmit={handleEnrollVerify} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Код будет отправлен на вашу почту. Нажмите «Отправить код», затем введите его ниже.
            </p>
            <FieldGroup>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendEnrollCode}
                  disabled={sending}
                >
                  {sending ? "Отправка…" : "Отправить код"}
                </Button>
              </div>
              <Field>
                <FieldLabel htmlFor="enroll-code-email" className="sr-only">
                  Код из письма
                </FieldLabel>
                <InputOTP
                  id="enroll-code-email"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-center gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>
              <div className="flex gap-2">
                <Button type="submit">Включить</Button>
                <Button type="button" variant="outline" onClick={handleCancelEnroll}>
                  Отмена
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}

        {state === "enrolling" && selectedMethod === "telegram" && (
          <form onSubmit={handleEnrollVerify} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Введите номер телефона, привязанный к Telegram. Код придёт в @VerificationCodes.
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="telegram-phone">Номер телефона</FieldLabel>
                <Input
                  id="telegram-phone"
                  type="tel"
                  placeholder="+79001234567"
                  value={telegramPhone}
                  onChange={(e) => setTelegramPhone(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendEnrollCode}
                disabled={sending || !telegramPhone.trim()}
              >
                {sending ? "Отправка…" : "Отправить код"}
              </Button>
              <Field>
                <FieldLabel htmlFor="enroll-code-telegram" className="sr-only">
                  Код из Telegram
                </FieldLabel>
                <InputOTP
                  id="enroll-code-telegram"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-center gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>
              <div className="flex gap-2">
                <Button type="submit">Включить</Button>
                <Button type="button" variant="outline" onClick={handleCancelEnroll}>
                  Отмена
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
