import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/objects */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })

    const q = new URL(request.url).searchParams.get("q")?.trim()
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("pageSize") ?? "20", 10) || 20))

    let query = supabase.from("construction_object").select("id, addressId, contractId, contractNumber, kitNo, buildType, projectId, projectName, foremanId, foremanName, amountCurrent, amountNext, contractStartDate, comment, createdAt, updatedAt, address(*)", { count: "exact" }).order("contractNumber", { ascending: true })
    if (q) query = query.or(`contractNumber.ilike.%${q}%,projectName.ilike.%${q}%`)
    const { data: rows, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1)

    if (error) {
      console.error("[GET /api/construction/objects]", error)
      return NextResponse.json({ error: "Ошибка загрузки объектов" }, { status: 500 })
    }

    const items = (rows ?? []).map((row: Record<string, unknown>) => {
      const addr = Array.isArray(row.address) ? row.address[0] : row.address
      const a = addr as Record<string, unknown> | null
      const fullText = a?.fullText as string | null
      const addressDisplay = fullText?.trim() || (a ? [a.region, a.district, a.locality, a.street, a.house].filter(Boolean).join(", ") : null) || null
      return {
        id: row.id,
        addressId: row.addressId,
        contractId: row.contractId,
        contractNumber: row.contractNumber,
        kitNo: row.kitNo,
        buildType: row.buildType,
        projectId: row.projectId,
        projectName: row.projectName,
        foremanId: row.foremanId,
        foremanName: row.foremanName,
        amountCurrent: row.amountCurrent != null ? Number(row.amountCurrent) : null,
        amountNext: row.amountNext != null ? Number(row.amountNext) : null,
        contractStartDate: (row.contractStartDate as string)?.slice(0, 10) ?? null,
        comment: row.comment,
        addressDisplay,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    })
    return NextResponse.json({ items, total: count ?? 0 })
  } catch (e) {
    console.error("[GET /api/construction/objects]", e)
    return NextResponse.json({ error: "Ошибка загрузки объектов" }, { status: 500 })
  }
}

/** POST /api/construction/objects */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })

    const body = await request.json()
    const contractNumber = (body.contractNumber as string)?.trim()
    if (!contractNumber) return NextResponse.json({ error: "Укажите номер договора (contractNumber)" }, { status: 400 })

    const { data: obj, error } = await supabase.from("construction_object").insert({
      id: randomUUID(),
      addressId: (body.addressId as string) || null,
      contractId: (body.contractId as string) || null,
      contractNumber,
      kitNo: body.kitNo != null ? body.kitNo : null,
      buildType: (body.buildType as string) || null,
      projectId: (body.projectId as string) || null,
      projectName: (body.projectName as string) || null,
      foremanId: (body.foremanId as string) || null,
      foremanName: (body.foremanName as string) || null,
      amountCurrent: body.amountCurrent != null ? body.amountCurrent : null,
      amountNext: body.amountNext != null ? body.amountNext : null,
      contractStartDate: body.contractStartDate ? new Date(body.contractStartDate).toISOString() : null,
      comment: (body.comment as string) || null,
      updatedAt: new Date().toISOString(),
    }).select("id, addressId, contractId, contractNumber, kitNo, buildType, projectId, projectName, foremanId, foremanName, amountCurrent, amountNext, contractStartDate, comment, createdAt, updatedAt, address(*)").single()

    if (error || !obj) {
      console.error("[POST /api/construction/objects]", error)
      return NextResponse.json({ error: "Ошибка создания объекта" }, { status: 500 })
    }

    const addr = Array.isArray(obj.address) ? obj.address[0] : obj.address
    const a = addr as Record<string, unknown> | null
    const fullText = a?.fullText as string | null
    const addressDisplay = fullText?.trim() || (a ? [a.region, a.district, a.locality, a.street, a.house].filter(Boolean).join(", ") : null) || null

    return NextResponse.json({
      id: obj.id,
      addressId: obj.addressId,
      contractId: obj.contractId,
      contractNumber: obj.contractNumber,
      kitNo: obj.kitNo,
      buildType: obj.buildType,
      projectId: obj.projectId,
      projectName: obj.projectName,
      foremanId: obj.foremanId,
      foremanName: obj.foremanName,
      amountCurrent: obj.amountCurrent != null ? Number(obj.amountCurrent) : null,
      amountNext: obj.amountNext != null ? Number(obj.amountNext) : null,
      contractStartDate: (obj.contractStartDate as string)?.slice(0, 10) ?? null,
      comment: obj.comment,
      addressDisplay,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    })
  } catch (e) {
    console.error("[POST /api/construction/objects]", e)
    return NextResponse.json({ error: "Ошибка создания объекта" }, { status: 500 })
  }
}
