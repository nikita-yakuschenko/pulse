"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ConfirmEmailPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/sign-in")
      setReady(true)
    })
  }, [router])

  async function handleResend() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: "signup" })
    setLoading(false)
    if (error) {
      toast.error(error.message === "Email rate limit exceeded" ? "Слишком частые запросы. Подождите несколько минут." : "Не удалось отправить письмо.")
      return
    }
    toast.success("Письмо отправлено. Проверьте почту и папку «Спам».")
  }

  if (!ready) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-xl font-semibold">Подтвердите адрес почты</h1>
            <p className="text-muted-foreground text-sm">
              Чтобы пользоваться личным кабинетом, нужно подтвердить email. Перейдите по ссылке из письма, которое мы отправили при регистрации.
            </p>
            <p className="text-muted-foreground text-sm">
              Письмо не пришло? Нажмите кнопку ниже — мы отправим его снова.
            </p>
            <Button onClick={handleResend} disabled={loading} className="w-full">
              {loading ? "Отправка…" : "Отправить письмо снова"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push("/sign-in")
              }}
            >
              Выйти и войти под другим аккаунтом
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
