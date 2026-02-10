"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconLoader } from "@tabler/icons-react"

export default function NewMrpReportPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function create() {
      try {
        const res = await fetch("/api/mrp/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const text = await res.text()
        let json: { error?: string; data?: { id?: string } } = {}
        try {
          json = text ? JSON.parse(text) : {}
        } catch {
          //
        }
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || "Не удалось создать отчёт")
          toast.error(json.error || "Не удалось создать отчёт")
          return
        }
        const id = json.data?.id
        if (id) {
          router.replace(`/purchases/analytics/${id}`)
        } else {
          setError("Нет id в ответе")
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Ошибка создания"
          setError(msg)
          toast.error(msg)
        }
      }
    }

    create()
    return () => { cancelled = true }
  }, [router])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center justify-center py-16 gap-3">
        <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {error ?? "Создание отчёта…"}
        </span>
      </div>
      {error && (
        <p className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
