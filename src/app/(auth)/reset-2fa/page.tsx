"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function Reset2FAPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Введите корректный email.")
      return
    }
    if (!password) {
      toast.error("Введите пароль.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/mfa/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось сбросить 2FA.")
        return
      }
      toast.success("2FA сброшена. Войдите с паролем.")
      router.push("/sign-in")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="text-center">
                  <h1 className="text-xl font-semibold">Сброс 2FA</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Потеряли доступ к приложению? Введите email и пароль — 2FA будет отключена.
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
                <Field>
                  <FieldLabel htmlFor="password">Пароль</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Сброс…" : "Сбросить 2FA"}
                </Button>
                <p className="text-center text-sm">
                  <Link href="/sign-in" className="text-muted-foreground underline underline-offset-4 hover:text-primary">
                    Вернуться ко входу
                  </Link>
                </p>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
