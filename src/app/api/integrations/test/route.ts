import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  let body: { type: string; settings: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Неверный запрос." }, { status: 400 })
  }

  const { type, settings } = body

  try {
    if (type === "1c") {
      return await test1C(settings)
    } else if (type === "bitrix24") {
      return await testBitrix24(settings)
    } else if (type === "telegram") {
      return await testTelegram(settings)
    } else {
      return NextResponse.json({ error: "Неизвестный тип интеграции." }, { status: 400 })
    }
  } catch (err) {
    console.error("Integration test error", err)
    return NextResponse.json({ error: "Ошибка при проверке подключения." }, { status: 500 })
  }
}

async function test1C(settings: Record<string, unknown>) {
  const { url, username, password } = settings as { url?: string; username?: string; password?: string }
  
  if (!url) {
    return NextResponse.json({ error: "URL не указан." }, { status: 400 })
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Логин и пароль обязательны." }, { status: 400 })
  }

  try {
    // Правильная кодировка для Basic Auth с поддержкой кириллицы
    const credentials = `${username}:${password}`
    const encoder = new TextEncoder()
    const data = encoder.encode(credentials)
    const base64 = Buffer.from(data).toString('base64')
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${base64}`,
    }

    // Проверяем подключение через health check endpoint
    const healthCheckUrl = url.endsWith('/') ? `${url}health/check` : `${url}/health/check`
    const res = await fetch(healthCheckUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const statusText = res.statusText || "Unknown"
      return NextResponse.json(
        { error: `1С вернула статус ${res.status} (${statusText}). Проверьте логин и пароль.` },
        { status: 400 }
      )
    }

    const responseData = await res.text()
    return NextResponse.json({ 
      success: true, 
      message: `Подключение к 1С успешно! Health check: OK (${responseData.length} байт).` 
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось подключиться к 1С: ${message}` },
      { status: 500 }
    )
  }
}

async function testBitrix24(settings: Record<string, unknown>) {
  const { webhookUrl } = settings as { webhookUrl?: string }
  
  if (!webhookUrl) {
    return NextResponse.json({ error: "Webhook URL не указан." }, { status: 400 })
  }

  try {
    const testUrl = webhookUrl.endsWith("/") ? `${webhookUrl}app.info` : `${webhookUrl}/app.info`
    const res = await fetch(testUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Битрикс24 вернул статус ${res.status}. Проверьте URL вебхука.` },
        { status: 400 }
      )
    }

    const data = await res.json()
    if (!data || data.error) {
      return NextResponse.json(
        { error: data?.error_description || "Ошибка вебхука." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, message: "Подключение к Битрикс24 успешно." })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось подключиться к Битрикс24: ${message}` },
      { status: 500 }
    )
  }
}

async function testTelegram(settings: Record<string, unknown>) {
  const { botToken } = settings as { botToken?: string }
  
  if (!botToken) {
    return NextResponse.json({ error: "Bot Token не указан." }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Telegram вернул ошибку. Проверьте токен бота." },
        { status: 400 }
      )
    }

    const data = await res.json()
    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || "Ошибка токена." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Бот подключен: @${data.result.username || "unknown"}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка"
    return NextResponse.json(
      { error: `Не удалось подключиться к Telegram: ${message}` },
      { status: 500 }
    )
  }
}
