"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : ""
    const params = new URLSearchParams(hash.replace(/^#/, ""))
    if (params.get("type") === "recovery") {
      setReady(true)
    } else {
      setReady(false)
      toast.error("Неверная или устаревшая ссылка. Запросите сброс пароля снова.")
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("Пароль должен быть не короче 6 символов.")
      return
    }
    if (password !== confirm) {
      toast.error("Пароли не совпадают.")
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error("Не удалось обновить пароль. Ссылка могла устареть.")
        return
      }
      toast.success("Пароль обновлён. Войдите с новым паролем.")
      router.push("/sign-in")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center text-sm">
              Используйте ссылку из письма для сброса пароля или{" "}
              <Link href="/forgot-password" className="text-primary underline">
                запросите новую
              </Link>
              .
            </p>
            <p className="mt-4 text-center">
              <Link href="/sign-in" className="text-primary text-sm underline">
                Вернуться ко входу
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="text-center">
                  <h1 className="text-xl font-semibold">Новый пароль</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Задайте новый пароль для входа
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="password">Новый пароль</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm">Повторите пароль</FieldLabel>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Сохранение…" : "Сохранить пароль"}
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
