import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/warehouse/all-prefs?section=balance|nomenclature
 *
 * Возвращает все настройки для раздела одним запросом:
 *  - groupPrefs: Record<string, { favorite: boolean; hidden: boolean }>
 *  - materialPrefs: Record<string, { favorite: boolean }>
 *  - searchExclusions: string[]
 *
 * Одна авторизация, три параллельных запроса к Supabase вместо трёх отдельных API-вызовов.
 */

const VALID_SECTIONS = new Set(["balance", "nomenclature"])

export async function GET(request: Request) {
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

    // Три запроса параллельно в одной Supabase-сессии
    const [groupRes, materialRes, exclusionRes] = await Promise.all([
      supabase
        .from("material_group_preference")
        .select("groupCode, favorite, hidden")
        .eq("userId", user.id)
        .eq("section", section),
      supabase
        .from("material_preference")
        .select("materialCode, favorite")
        .eq("userId", user.id)
        .eq("section", section)
        .eq("favorite", true),
      supabase
        .from("search_exclusion")
        .select("groupCode")
        .eq("userId", user.id)
        .eq("section", section),
    ])

    // Group prefs
    const groupPrefs: Record<string, { favorite: boolean; hidden: boolean }> = {}
    if (!groupRes.error) {
      for (const row of groupRes.data ?? []) {
        groupPrefs[row.groupCode] = {
          favorite: row.favorite ?? false,
          hidden: row.hidden ?? false,
        }
      }
    }

    // Material prefs
    const materialPrefs: Record<string, { favorite: boolean }> = {}
    if (!materialRes.error) {
      for (const row of materialRes.data ?? []) {
        materialPrefs[row.materialCode] = { favorite: true }
      }
    }

    // Search exclusions
    const searchExclusions: string[] = !exclusionRes.error
      ? (exclusionRes.data ?? []).map((r) => r.groupCode)
      : []

    return NextResponse.json({
      groupPrefs,
      materialPrefs,
      searchExclusions,
    })
  } catch (err) {
    console.error("[GET /api/warehouse/all-prefs]", err)
    return NextResponse.json(
      { error: "Ошибка загрузки настроек" },
      { status: 500 }
    )
  }
}
