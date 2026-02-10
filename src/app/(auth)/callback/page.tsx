"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { IconLoader } from "@tabler/icons-react"

// Страница, на которую Supabase редиректит после перехода по ссылке из письма подтверждения.
// Клиент подхватывает токены из hash и редиректит в дашборд.
export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ok")
        router.replace("/dashboard")
      } else {
        setStatus("error")
        router.replace("/sign-in?reason=confirm_failed")
      }
    })
  }, [router])

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <IconLoader className="size-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground text-sm">
          {status === "loading" && "Подтверждение входа…"}
          {status === "ok" && "Перенаправление в личный кабинет…"}
          {status === "error" && "Не удалось подтвердить. Переход на страницу входа…"}
        </p>
      </div>
    </div>
  )
}
