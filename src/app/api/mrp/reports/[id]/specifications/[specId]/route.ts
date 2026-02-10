import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * DELETE /api/mrp/reports/[id]/specifications/[specId]
 * Удалить спецификацию из отчёта.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; specId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { id: reportId, specId } = await params

    const { data: report } = await supabase
      .from("mrp_report")
      .select("id")
      .eq("id", reportId)
      .eq("userId", user.id)
      .single()

    if (!report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    const { data: spec } = await supabase
      .from("mrp_report_specification")
      .select("id")
      .eq("id", specId)
      .eq("reportId", reportId)
      .single()

    if (!spec) {
      return NextResponse.json({ error: "Спецификация не найдена в отчёте" }, { status: 404 })
    }

    await supabase.from("mrp_report_specification").delete().eq("id", specId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/mrp/reports/[id]/specifications/[specId]]", error)
    return NextResponse.json(
      { error: "Не удалось удалить спецификацию" },
      { status: 500 }
    )
  }
}
