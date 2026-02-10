import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOneCCredentials } from "@/integrations/1c"
import { ONE_C_URLS } from "@/lib/1c-client"
import { createBasicAuthHeader } from "@/lib/1c-client"

/**
 * GET /api/1c/supplier-orders/file/[id]
 * Прокси: возвращает файл из 1С по ИдентификаторХранилища (UUID из ДопИнформация).
 * Авторизация — текущий пользователь, настройки 1С из метаданных.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json({ error: "Параметр id обязателен" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const credentials = await getOneCCredentials(user.user_metadata || {})
    if (!credentials) {
      return NextResponse.json(
        { error: "Интеграция 1С не настроена" },
        { status: 400 }
      )
    }

    const baseUrl = ONE_C_URLS[credentials.environment as keyof typeof ONE_C_URLS]
    const authHeader = createBasicAuthHeader(credentials.username, credentials.password)
    const idTrimmed = id.trim()

    // В BSL указано «/get/file/{id}» — путь может быть без префикса sorders (в зависимости от регистрации HTTP-сервиса в 1С)
    const candidates = [
      `${baseUrl}sorders/get/file/${encodeURIComponent(idTrimmed)}`,
      `${baseUrl}get/file/${encodeURIComponent(idTrimmed)}`,
    ]
    let res: Response | null = null
    for (const url of candidates) {
      res = await fetch(url, { method: "GET", headers: { Authorization: authHeader } })
      if (res.ok) break
      if (res.status !== 404) break
    }
    if (!res) {
      return NextResponse.json({ error: "Не удалось запросить файл" }, { status: 502 })
    }

    if (!res.ok) {
      if (res.status === 404) {
        console.warn("[1C file] 404, пробовали URL:", candidates)
        return NextResponse.json({ error: "Файл не найден" }, { status: 404 })
      }
      const text = await res.text()
      return NextResponse.json(
        { error: text || `1С вернул ${res.status}` },
        { status: res.status }
      )
    }

    let contentType = res.headers.get("Content-Type") || "application/octet-stream"
    const contentDisposition = res.headers.get("Content-Disposition") || ""
    // Для просмотра в браузере (iframe/img): задаём тип по расширению, если 1С вернул octet-stream
    if (contentType === "application/octet-stream" && contentDisposition) {
      const match = contentDisposition.match(/filename[^=]*="?([^"]+)"?/i)
      const name = (match?.[1] || "").toLowerCase()
      if (name.endsWith(".pdf")) contentType = "application/pdf"
      else if (name.endsWith(".png")) contentType = "image/png"
      else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) contentType = "image/jpeg"
      else if (name.endsWith(".gif")) contentType = "image/gif"
      else if (name.endsWith(".webp")) contentType = "image/webp"
    }

    // inline — чтобы iframe/просмотрщик мог отобразить файл (attachment даёт белый экран)
    const disp = contentDisposition.toLowerCase().includes("attachment")
      ? contentDisposition.replace(/attachment/i, "inline")
      : contentDisposition || undefined
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(disp && { "Content-Disposition": disp }),
      },
    })
  } catch (error) {
    console.error("Ошибка получения файла из 1С:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 }
    )
  }
}
