import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/mrp/reports/[id]
 * Один отчёт со спецификациями и результатами расчёта.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { id } = await params

    const { data: report, error } = await supabase
      .from("mrp_report")
      .select("*")
      .eq("id", id)
      .eq("userId", user.id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    const [specsRes, resultsRes] = await Promise.all([
      supabase.from("mrp_report_specification").select("*").eq("reportId", id),
      supabase.from("mrp_report_result").select("*").eq("reportId", id),
    ])

    const data = {
      ...report,
      specifications: specsRes.data ?? [],
      results: resultsRes.data ?? [],
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[GET /api/mrp/reports/[id]]", error)
    return NextResponse.json(
      { error: "Ошибка загрузки отчёта" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/mrp/reports/[id]
 * Обновить название отчёта. Body: { title?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" ? body.title.trim() || null : null

    const { data: updated, error } = await supabase
      .from("mrp_report")
      .update({ title: title ?? null, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("userId", user.id)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    const [specsRes, resultsRes] = await Promise.all([
      supabase.from("mrp_report_specification").select("*").eq("reportId", id),
      supabase.from("mrp_report_result").select("*").eq("reportId", id),
    ])

    const data = {
      ...updated,
      specifications: specsRes.data ?? [],
      results: resultsRes.data ?? [],
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[PATCH /api/mrp/reports/[id]]", error)
    return NextResponse.json(
      { error: "Не удалось обновить отчёт" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/mrp/reports/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { id } = await params

    const { data: report, error } = await supabase
      .from("mrp_report")
      .select("id")
      .eq("id", id)
      .eq("userId", user.id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    await supabase.from("mrp_report").delete().eq("id", id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/mrp/reports/[id]]", error)
    return NextResponse.json(
      { error: "Не удалось удалить отчёт" },
      { status: 500 }
    )
  }
}
