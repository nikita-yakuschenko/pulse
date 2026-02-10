import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export type MaterialPrefsResponse = {
  data: Record<string, { favorite: boolean }>
}

const VALID_SECTIONS = new Set(["balance", "nomenclature"])

/**
 * GET /api/warehouse/material-prefs?section=balance|nomenclature
 * Избранные материалы текущего пользователя
 * section по умолчанию — "balance"
 */
export async function GET(request: Request): Promise<NextResponse<MaterialPrefsResponse | { error: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get("section") ?? "balance"

    if (!VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: "Недопустимое значение section" }, { status: 400 })
    }

    const { data: rows, error } = await supabase
      .from("material_preference")
      .select("materialCode, favorite")
      .eq("userId", user.id)
      .eq("section", section)
      .eq("favorite", true)

    if (error) {
      console.error("[GET /api/warehouse/material-prefs] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка загрузки избранных материалов" },
        { status: 500 }
      )
    }

    const data: Record<string, { favorite: boolean }> = {}
    for (const row of rows ?? []) {
      data[row.materialCode] = { favorite: true }
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("[GET /api/warehouse/material-prefs]", err)
    return NextResponse.json(
      { error: "Ошибка загрузки избранных материалов" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/warehouse/material-prefs
 * Установить/снять избранное для материала.
 * Body: { materialCode: string, section?: string, favorite: boolean }
 * section по умолчанию — "balance"
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const { materialCode, section = "balance", favorite } = body as {
      materialCode?: string
      section?: string
      favorite?: boolean
    }

    if (!materialCode || typeof materialCode !== "string") {
      return NextResponse.json(
        { error: "Не указан код материала" },
        { status: 400 }
      )
    }

    if (!VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: "Недопустимое значение section" }, { status: 400 })
    }

    if (typeof favorite !== "boolean") {
      return NextResponse.json(
        { error: "Укажите favorite: true или false" },
        { status: 400 }
      )
    }

    // Читаем текущие значения (если запись существует)
    const { data: existing } = await supabase
      .from("material_preference")
      .select("id")
      .eq("userId", user.id)
      .eq("materialCode", materialCode)
      .eq("section", section)
      .maybeSingle()

    const now = new Date().toISOString()

    // Upsert: вставка или обновление по уникальному ключу (userId, materialCode, section)
    const { data: result, error } = await supabase
      .from("material_preference")
      .upsert(
        {
          id: existing?.id ?? randomUUID(),
          userId: user.id,
          materialCode,
          section,
          favorite,
          createdAt: now,
          updatedAt: now,
        },
        { onConflict: "userId,materialCode,section" }
      )
      .select()
      .single()

    if (error) {
      console.error("[PATCH /api/warehouse/material-prefs] Upsert error:", error)
      return NextResponse.json(
        { error: "Ошибка сохранения" },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error("[PATCH /api/warehouse/material-prefs]", err)
    return NextResponse.json(
      { error: "Ошибка сохранения" },
      { status: 500 }
    )
  }
}
