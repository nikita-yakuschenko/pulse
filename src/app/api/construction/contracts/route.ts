import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/contracts — договоры для combobox (?q= поиск по номеру) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }
    const q = new URL(request.url).searchParams.get("q")?.trim()
    let query = supabase
      .from("contract")
      .select("*, address(*), project_catalog(*), employee(*)")
      .order("contractNumber", { ascending: true })
      .limit(50)
    if (q) {
      query = query.ilike("contractNumber", `%${q}%`)
    }
    const { data: list, error } = await query
    if (error) {
      console.error("[GET /api/construction/contracts]", error)
      return NextResponse.json({ error: "Ошибка загрузки договоров" }, { status: 500 })
    }
    const items = (list ?? []).map((c: Record<string, unknown>) => {
      const address = Array.isArray(c.address) ? c.address[0] : c.address
      const project = Array.isArray(c.project_catalog) ? c.project_catalog[0] : c.project_catalog
      const foreman = Array.isArray(c.employee) ? c.employee[0] : c.employee
      const addr = address as Record<string, unknown> | null
      const fullText = addr?.fullText as string | null
      const region = addr?.region as string | null
      const locality = addr?.locality as string | null
      const street = addr?.street as string | null
      const house = addr?.house as string | null
      const addressDisplay = fullText?.trim() || [region, locality, street, house].filter(Boolean).join(", ") || null
      return {
        id: c.id,
        contractNumber: c.contractNumber,
        kitNo: c.kitNo,
        addressId: c.addressId,
        buildType: c.buildType,
        projectId: c.projectId,
        foremanId: c.foremanId,
        amount: c.amount != null ? Number(c.amount) : null,
        addressDisplay,
        projectName: (project as Record<string, unknown>)?.name ?? null,
        foremanName: (foreman as Record<string, unknown>)?.name ?? null,
      }
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error("[GET /api/construction/contracts]", e)
    return NextResponse.json({ error: "Ошибка загрузки договоров" }, { status: 500 })
  }
}
