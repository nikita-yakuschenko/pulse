import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

/**
 * GET /api/mrp/reports
 * Список MRP-отчётов текущего пользователя (по дате создания, новые сверху).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { data: reports, error } = await supabase
      .from("mrp_report")
      .select("*")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false })

    if (error) {
      console.error("[GET /api/mrp/reports] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка загрузки отчётов" },
        { status: 500 }
      )
    }

    const list = reports ?? []
    if (list.length === 0) {
      return NextResponse.json({
        data: list,
      })
    }

    const ids = list.map((r) => r.id)
    const [specsRes, resultsRes] = await Promise.all([
      supabase.from("mrp_report_specification").select("reportId").in("reportId", ids),
      supabase.from("mrp_report_result").select("reportId").in("reportId", ids),
    ])

    const specCountByReport = new Map<string, number>()
    for (const row of specsRes.data ?? []) {
      const id = row.reportId
      specCountByReport.set(id, (specCountByReport.get(id) ?? 0) + 1)
    }
    const resultCountByReport = new Map<string, number>()
    for (const row of resultsRes.data ?? []) {
      const id = row.reportId
      resultCountByReport.set(id, (resultCountByReport.get(id) ?? 0) + 1)
    }

    const withCounts = list.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      specCount: specCountByReport.get(r.id) ?? 0,
      resultCount: resultCountByReport.get(r.id) ?? 0,
    }))

    const seenTitles = new Set<string>()
    const deduped = withCounts.filter((r) => {
      const key = (r.title ?? "") || r.id
      if (seenTitles.has(key)) return false
      const sameTitle = withCounts.filter((x) => ((x.title ?? "") || x.id) === key)
      const best = sameTitle.sort((a, b) => {
        if (a.status === "computed" && b.status !== "computed") return -1
        if (a.status !== "computed" && b.status === "computed") return 1
        return (b.specCount ?? 0) - (a.specCount ?? 0)
      })[0]
      if (best.id !== r.id) return false
      seenTitles.add(key)
      return true
    })

    return NextResponse.json({ data: deduped })
  } catch (error) {
    console.error("[GET /api/mrp/reports]", error)
    return NextResponse.json(
      { error: "Ошибка загрузки отчётов" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/mrp/reports
 * Создать новый MRP-отчёт (черновик). Body: { title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    let title = typeof body.title === "string" ? body.title.trim() || null : null

    if (!title) {
      const { count } = await supabase
        .from("mrp_report")
        .select("*", { count: "exact", head: true })
        .eq("userId", user.id)
      const n = (count ?? 0) + 1
      const nowDate = new Date()
      const year = nowDate.getFullYear() % 100
      const month = nowDate.getMonth()
      const firstDay = new Date(nowDate.getFullYear(), month, 1)
      const lastDay = new Date(nowDate.getFullYear(), month + 1, 0)
      const pad = (x: number) => String(x).padStart(2, "0")
      const startStr = `${pad(firstDay.getDate())}.${pad(firstDay.getMonth() + 1)}.${pad(year)}`
      const endStr = `${pad(lastDay.getDate())}.${pad(lastDay.getMonth() + 1)}.${pad(year)}`
      title = `MRP-отчёт №${n} на период ${startStr} - ${endStr}`
    }

    const now = new Date().toISOString()
    const report = {
      id: randomUUID(),
      title,
      userId: user.id,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    }

    const { error } = await supabase.from("mrp_report").insert(report)

    if (error) {
      console.error("[POST /api/mrp/reports] Supabase error:", error)
      return NextResponse.json(
        { error: "Не удалось создать отчёт" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: report })
  } catch (error) {
    console.error("[POST /api/mrp/reports]", error)
    return NextResponse.json(
      { error: "Не удалось создать отчёт" },
      { status: 500 }
    )
  }
}
