"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IconLoader } from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MfaVerifyForm } from "@/components/mfa-verify-form"

type MfaStatus = {
  needsMfa: boolean
  method: "totp" | "email" | "telegram" | null
  telegramPhone?: string
  needsReLogin?: boolean
}

type UserProp = {
  name: string
  email: string
  avatar?: string
} | null

const sidebarStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as React.CSSProperties

export function DashboardGate({
  children,
  userProp,
}: {
  children: React.ReactNode
  userProp: UserProp
}) {
  const router = useRouter()
  const [status, setStatus] = useState<MfaStatus | null>(null)

  async function checkStatus() {
    const res = await fetch("/api/mfa/status")
    const json = await res.json()
    if (json.needsReLogin) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace("/sign-in?reason=session_expired")
      return
    }
    if (json.needsMfa && json.method) {
      setStatus({
        needsMfa: true,
        method: json.method,
        telegramPhone: json.telegramPhone,
      })
      return
    }
    setStatus({ needsMfa: false, method: null })
  }

  useEffect(() => {
    checkStatus()
  }, [])

  // До результата проверки — нейтральный индикатор (без текста о проверке доступа)
  if (status === null) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center" aria-busy="true">
        <IconLoader className="size-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  // Требуется 2FA — только форма на весь экран, без сайдбара
  if (status.needsMfa && status.method) {
    return (
      <div className="bg-background flex min-h-svh w-full items-center justify-center px-4 py-6">
        <MfaVerifyForm
          method={status.method}
          telegramPhone={status.telegramPhone}
          onSuccess={() => checkStatus()}
        />
      </div>
    )
  }

  // 2FA пройдена — рендерим полный интерфейс дашборда
  return (
    <SidebarProvider style={sidebarStyle}>
      <AppSidebar variant="inset" user={userProp} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
