"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = (formData.get("email") as string)?.trim() ?? ""
    const password = formData.get("password") as string
    if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Не удалось войти. Проверьте введённые данные.")
      return
    }
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (err) {
      toast.error("Не удалось войти. Проверьте введённые данные.")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} noValidate className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">С возвращением</h1>
                <p className="text-muted-foreground text-balance">
                  Войдите в свой аккаунт Модуль.Пульс
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Пароль</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground ml-auto text-sm underline underline-offset-4 hover:text-primary"
                  >
                    Забыли пароль?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full">
                  Войти
                </Button>
              </Field>
              <FieldDescription className="text-center">
                Нет аккаунта?{" "}
                <Link
                  href="/sign-up"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Регистрация
                </Link>
              </FieldDescription>
              <FieldDescription className="text-center">
                Потеряли доступ к 2FA?{" "}
                <Link
                  href="/reset-2fa"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Сбросить
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <div
              className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent dark:from-primary/10 dark:via-primary/5"
              aria-hidden
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
