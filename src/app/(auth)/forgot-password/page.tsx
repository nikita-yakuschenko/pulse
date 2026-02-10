"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Введите корректный email.")
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/update-password`,
      })
      if (error) {
        toast.error("Не удалось отправить письмо. Попробуйте позже.")
        return
      }
      setSent(true)
      toast.success("Письмо со ссылкой для сброса пароля отправлено на почту.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-4 text-center">
                <p className="text-muted-foreground text-sm">
                  Проверьте почту {email}. Перейдите по ссылке из письма, чтобы задать новый пароль.
                </p>
                <Link href="/sign-in" className="text-primary text-sm underline underline-offset-4">
                  Вернуться ко входу
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <div className="text-center">
                    <h1 className="text-xl font-semibold">Восстановление пароля</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Введите email — отправим ссылку для сброса пароля
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Отправка…" : "Отправить ссылку"}
                  </Button>
                  <p className="text-center text-sm">
                    <Link href="/sign-in" className="text-muted-foreground underline underline-offset-4 hover:text-primary">
                      Вернуться ко входу
                    </Link>
                  </p>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
