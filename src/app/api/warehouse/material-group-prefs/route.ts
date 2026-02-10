import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export type MaterialGroupPrefsResponse = {
  data: Record<string, { favorite: boolean; hidden: boolean }>
}

const VALID_SECTIONS = new Set(["balance", "nomenclature"])

/**
 * GET /api/warehouse/material-group-prefs?section=balance|nomenclature
 * Настройки групп номенклатуры текущего пользователя (избранное, скрытие)
 * section по умолчанию — "balance"
 */
export async function GET(request: Request): Promise<NextResponse<MaterialGroupPrefsResponse | { error: string }>> {
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
      .from("material_group_preference")
      .select("groupCode, favorite, hidden")
      .eq("userId", user.id)
      .eq("section", section)

    if (error) {
      console.error("[GET /api/warehouse/material-group-prefs] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка загрузки настроек групп" },
        { status: 500 }
      )
    }

    const data: Record<string, { favorite: boolean; hidden: boolean }> = {}
    for (const row of rows ?? []) {
      data[row.groupCode] = {
        favorite: row.favorite ?? false,
        hidden: row.hidden ?? false,
      }
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("[GET /api/warehouse/material-group-prefs]", err)
    return NextResponse.json(
      { error: "Ошибка загрузки настроек групп" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/warehouse/material-group-prefs
 * Установить favorite и/или hidden для группы.
 * Скрытая группа не может быть в избранном; при скрытии группа убирается из избранного.
 * Body: { groupCode: string, section?: string, favorite?: boolean, hidden?: boolean }
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
    const { groupCode, section = "balance", favorite, hidden } = body as {
      groupCode?: string
      section?: string
      favorite?: boolean
      hidden?: boolean
    }

    if (!groupCode || typeof groupCode !== "string") {
      return NextResponse.json(
        { error: "Не указан код группы" },
        { status: 400 }
      )
    }

    if (!VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: "Недопустимое значение section" }, { status: 400 })
    }

    // Читаем текущие значения (если запись существует)
    const { data: existing } = await supabase
      .from("material_group_preference")
      .select("id, favorite, hidden")
      .eq("userId", user.id)
      .eq("groupCode", groupCode)
      .eq("section", section)
      .maybeSingle()

    const now = new Date().toISOString()

    let nextFavorite = existing?.favorite ?? false
    let nextHidden = existing?.hidden ?? false

    if (typeof hidden === "boolean") {
      nextHidden = hidden
      if (hidden) nextFavorite = false
    }
    if (typeof favorite === "boolean") {
      if (favorite && nextHidden) {
        return NextResponse.json(
          { error: "Скрытая группа не может быть в избранном" },
          { status: 400 }
        )
      }
      nextFavorite = nextHidden ? false : favorite
    }

    // Upsert: вставка или обновление по уникальному ключу (userId, groupCode, section)
    const { data: result, error } = await supabase
      .from("material_group_preference")
      .upsert(
        {
          id: existing?.id ?? randomUUID(),
          userId: user.id,
          groupCode,
          section,
          favorite: nextFavorite,
          hidden: nextHidden,
          createdAt: now,
          updatedAt: now,
        },
        { onConflict: "userId,groupCode,section" }
      )
      .select()
      .single()

    if (error) {
      console.error("[PATCH /api/warehouse/material-group-prefs] Upsert error:", error)
      return NextResponse.json(
        { error: "Ошибка сохранения настроек" },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error("[PATCH /api/warehouse/material-group-prefs]", err)
    return NextResponse.json(
      { error: "Ошибка сохранения настроек" },
      { status: 500 }
    )
  }
}
