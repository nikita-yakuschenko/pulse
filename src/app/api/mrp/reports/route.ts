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
    const periodYear = typeof body.year === "number" ? body.year : typeof body.year === "string" ? parseInt(body.year, 10) : undefined
    const periodMonth = typeof body.month === "number" ? body.month : typeof body.month === "string" ? parseInt(body.month, 10) : undefined

    if (!title) {
      const { count } = await supabase
        .from("mrp_report")
        .select("*", { count: "exact", head: true })
        .eq("userId", user.id)
      const n = (count ?? 0) + 1
      const nowDate = new Date()
      const year = periodYear ?? nowDate.getFullYear()
      const month = periodMonth !== undefined ? periodMonth - 1 : nowDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const pad = (x: number) => String(x).padStart(2, "0")
      const yearShort = year % 100
      const startStr = `${pad(firstDay.getDate())}.${pad(firstDay.getMonth() + 1)}.${pad(yearShort)}`
      const endStr = `${pad(lastDay.getDate())}.${pad(lastDay.getMonth() + 1)}.${pad(yearShort)}`
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

    const rawSpecs = Array.isArray(body.specifications)
      ? body.specifications
      : Array.isArray(body.specificationCodes)
        ? (body.specificationCodes as string[]).filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => ({ specificationCode: c.trim(), specificationName: null }))
        : []
    const specItems = rawSpecs
      .map((s: unknown) => {
        if (typeof s === "string") return { specificationCode: s.trim(), specificationName: null as string | null }
        if (s && typeof s === "object" && "specificationCode" in s) {
          const code = String((s as { specificationCode?: unknown }).specificationCode ?? "").trim()
          const name = (s as { specificationName?: unknown }).specificationName
          return {
            specificationCode: code,
            specificationName: typeof name === "string" ? name.trim() || null : null,
          }
        }
        return null
      })
      .filter((s): s is { specificationCode: string; specificationName: string | null } => !!s && s.specificationCode !== "")
    if (specItems.length > 0) {
      const specs = specItems.map(({ specificationCode, specificationName }) => ({
        id: randomUUID(),
        reportId: report.id,
        specificationCode,
        specificationName,
      }))
      const { error: specError } = await supabase.from("mrp_report_specification").insert(specs)
      if (specError) {
        console.error("[POST /api/mrp/reports] insert specifications error:", specError)
      }
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
