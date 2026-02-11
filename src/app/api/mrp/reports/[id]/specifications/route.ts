import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSpecifications } from "@/integrations/1c"
import { randomUUID } from "crypto"

/**
 * POST /api/mrp/reports/[id]/specifications
 * Добавить спецификацию в отчёт. Body: { specificationCode: string, specificationName?: string }
 */
export async function POST(
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

    const { id: reportId } = await params

    const { data: report, error: reportError } = await supabase
      .from("mrp_report")
      .select("id, status")
      .eq("id", reportId)
      .eq("userId", user.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Спецификации можно добавлять только в черновик" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    let specificationCode = typeof body.specificationCode === "string" ? body.specificationCode.trim() : ""
    let specificationName = typeof body.specificationName === "string" ? body.specificationName.trim() || null : null

    if (!specificationCode) {
      return NextResponse.json(
        { error: "Укажите код спецификации (specificationCode)" },
        { status: 400 }
      )
    }

    if (!specificationName) {
      try {
        const metadata = (user.user_metadata || {}) as Record<string, unknown>
        const raw = await getSpecifications(metadata, { code: specificationCode })
        const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data?: unknown }).data)) ? (raw as { data: unknown[] }).data : []
        const first = list[0] as Record<string, unknown> | undefined
        const name = first && first.Наименование != null ? String(first.Наименование).trim() : null
        if (name) specificationName = name
      } catch (e) {
        console.warn("[POST /api/mrp/reports/[id]/specifications] fetch name from 1C:", e)
      }
    }

    const { data: existing } = await supabase
      .from("mrp_report_specification")
      .select("id")
      .eq("reportId", reportId)
      .eq("specificationCode", specificationCode)
      .maybeSingle()

    if (existing) {
      const { data: full } = await supabase
        .from("mrp_report_specification")
        .select("*")
        .eq("id", existing.id)
        .single()
      return NextResponse.json({ data: full ?? existing })
    }

    const spec = {
      id: randomUUID(),
      reportId,
      specificationCode,
      specificationName,
    }

    const { error } = await supabase.from("mrp_report_specification").insert(spec)

    if (error) {
      console.error("[POST /api/mrp/reports/[id]/specifications] Supabase error:", error)
      return NextResponse.json(
        { error: "Не удалось добавить спецификацию" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: spec })
  } catch (error) {
    console.error("[POST /api/mrp/reports/[id]/specifications]", error)
    return NextResponse.json(
      { error: "Не удалось добавить спецификацию" },
      { status: 500 }
    )
  }
}
