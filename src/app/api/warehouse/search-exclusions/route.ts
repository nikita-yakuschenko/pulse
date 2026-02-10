import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export type SearchExclusionsResponse = {
  /** Массив кодов исключённых групп */
  data: string[]
}

const VALID_SECTIONS = new Set(["balance", "nomenclature"])

/**
 * GET /api/warehouse/search-exclusions?section=nomenclature
 * Возвращает коды групп, исключённых из поиска для текущего пользователя
 * section по умолчанию — "nomenclature"
 */
export async function GET(request: Request): Promise<NextResponse<SearchExclusionsResponse | { error: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get("section") ?? "nomenclature"

    if (!VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: "Недопустимое значение section" }, { status: 400 })
    }

    const { data: rows, error } = await supabase
      .from("search_exclusion")
      .select("groupCode")
      .eq("userId", user.id)
      .eq("section", section)

    if (error) {
      console.error("[GET /api/warehouse/search-exclusions] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка загрузки исключений поиска" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: (rows ?? []).map((r) => r.groupCode) })
  } catch (err) {
    console.error("[GET /api/warehouse/search-exclusions]", err)
    return NextResponse.json(
      { error: "Ошибка загрузки исключений поиска" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/warehouse/search-exclusions
 * Полностью заменяет список исключённых групп для текущего пользователя.
 * Body: { section?: string, groupCodes: string[] }
 * section по умолчанию — "nomenclature"
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const { section = "nomenclature", groupCodes } = body as {
      section?: string
      groupCodes?: string[]
    }

    if (!VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: "Недопустимое значение section" }, { status: 400 })
    }

    if (!Array.isArray(groupCodes)) {
      return NextResponse.json(
        { error: "groupCodes должен быть массивом строк" },
        { status: 400 }
      )
    }

    // Удаляем все текущие исключения для пользователя + раздела
    const { error: deleteErr } = await supabase
      .from("search_exclusion")
      .delete()
      .eq("userId", user.id)
      .eq("section", section)

    if (deleteErr) {
      console.error("[PUT /api/warehouse/search-exclusions] Delete error:", deleteErr)
      return NextResponse.json(
        { error: "Ошибка очистки исключений" },
        { status: 500 }
      )
    }

    // Вставляем новые (если есть)
    if (groupCodes.length > 0) {
      const now = new Date().toISOString()
      const rows = groupCodes.map((code) => ({
        id: randomUUID(),
        userId: user.id,
        groupCode: code,
        section,
        createdAt: now,
      }))

      const { error: insertErr } = await supabase
        .from("search_exclusion")
        .insert(rows)

      if (insertErr) {
        console.error("[PUT /api/warehouse/search-exclusions] Insert error:", insertErr)
        return NextResponse.json(
          { error: "Ошибка сохранения исключений" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ data: groupCodes })
  } catch (err) {
    console.error("[PUT /api/warehouse/search-exclusions]", err)
    return NextResponse.json(
      { error: "Ошибка сохранения исключений" },
      { status: 500 }
    )
  }
}
