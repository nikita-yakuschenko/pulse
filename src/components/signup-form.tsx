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

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string)?.trim() ?? ""
    const email = (formData.get("email") as string)?.trim() ?? ""
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string
    const valid =
      name &&
      email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      password.length >= 8 &&
      password === confirmPassword
    if (!valid) {
      toast.error("Не удалось создать аккаунт. Проверьте введённые данные.")
      return
    }
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    if (err) {
      const isSmtpError = /confirmation email|smtp|mail/i.test(err.message ?? "")
      const message = isSmtpError
        ? "Сервер не может отправить письмо подтверждения. Проверьте настройки SMTP в Supabase (пароль в кавычках, SMTP_ADMIN_EMAIL). Временно можно включить ENABLE_EMAIL_AUTOCONFIRM=true."
        : (err.message || "Не удалось создать аккаунт. Проверьте введённые данные.")
      toast.error(message)
      return
    }
    // Если сессии нет — включено подтверждение почты, редирект на страницу «проверьте почту»
    if (!data.session) {
      router.push("/check-email")
      router.refresh()
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} noValidate className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Регистрация</h1>
                <p className="text-muted-foreground text-balance text-sm">
                  Введите данные для создания аккаунта
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="name">Имя</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Иван Иванов"
                  autoComplete="name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <FieldDescription>
                  Минимум 8 символов.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Подтвердите пароль</FieldLabel>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full">
                  Создать аккаунт
                </Button>
              </Field>
              <FieldDescription className="text-center">
                Уже есть аккаунт?{" "}
                <Link href="/sign-in" className="text-primary underline underline-offset-4 hover:text-primary/80">
                  Вход
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
