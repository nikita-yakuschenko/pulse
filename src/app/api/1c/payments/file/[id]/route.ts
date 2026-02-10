import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOneCClient, getOneCCredentials } from "@/integrations/1c"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from("users")
      .select("one_c_integration")
      .eq("id", user.id)
      .single()

    if (!userData?.one_c_integration) {
      return NextResponse.json(
        { error: "1С интеграция не настроена" },
        { status: 400 }
      )
    }

    const metadata = user.user_metadata
    const credentials = await getOneCCredentials(metadata)
    if (!credentials) {
      return NextResponse.json(
        { error: "1С credentials не найдены" },
        { status: 400 }
      )
    }

    const client = createOneCClient(credentials)
    const fileId = params.id

    // Запрос к 1С API для скачивания файла
    const response = await client.get(`payments/file/${encodeURIComponent(fileId)}`, {
      responseType: "arraybuffer",
    })

    // Пытаемся извлечь имя файла из заголовков
    const contentDisposition = response.headers["content-disposition"]
    let fileName = "file"
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1].replace(/['"]/g, "")
      }
    }

    const contentType = response.headers["content-type"] || "application/octet-stream"

    // inline — чтобы iframe/просмотрщик мог отобразить файл; attachment заставляет скачивать и даёт белый экран
    return new NextResponse(response.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Ошибка скачивания файла платежа:", error)
    return NextResponse.json(
      { error: "Не удалось скачать файл" },
      { status: 500 }
    )
  }
}
