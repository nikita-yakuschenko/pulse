"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IconLoader } from "@tabler/icons-react"
import { createClient } from "@/lib/supabase/client"
import { MfaVerifyForm } from "@/components/mfa-verify-form"

type MfaStatus = {
  needsMfa: boolean
  method: "totp" | "email" | "telegram" | null
  telegramPhone?: string
  needsReLogin?: boolean
}

export function MfaGuard({ children }: { children: React.ReactNode }) {
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

  if (status === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
        <IconLoader className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (status.needsMfa && status.method) {
    return (
      <MfaVerifyForm
        method={status.method}
        telegramPhone={status.telegramPhone}
        onSuccess={() => checkStatus()}
      />
    )
  }

  return <>{children}</>
}
