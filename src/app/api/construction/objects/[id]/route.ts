import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** GET /api/construction/objects/[id] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }
    const { id } = await params
    const { data: obj, error } = await supabase
      .from("construction_object")
      .select("id, addressId, contractId, contractNumber, kitNo, buildType, projectId, projectName, foremanId, foremanName, amountCurrent, amountNext, contractStartDate, comment, createdAt, updatedAt, address(*)")
      .eq("id", id)
      .single()

    if (error || !obj) {
      return NextResponse.json({ error: "Объект не найден" }, { status: 404 })
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
    console.error("[GET /api/construction/objects/[id]]", e)
    return NextResponse.json({ error: "Ошибка загрузки объекта" }, { status: 500 })
  }
}

/** PATCH /api/construction/objects/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (body.addressId !== undefined) data.addressId = body.addressId || null
    if (body.contractId !== undefined) data.contractId = body.contractId || null
    if (body.contractNumber !== undefined) data.contractNumber = body.contractNumber
    if (body.kitNo !== undefined) data.kitNo = body.kitNo != null ? body.kitNo : null
    if (body.buildType !== undefined) data.buildType = body.buildType || null
    if (body.projectId !== undefined) data.projectId = body.projectId || null
    if (body.projectName !== undefined) data.projectName = body.projectName || null
    if (body.foremanId !== undefined) data.foremanId = body.foremanId || null
    if (body.foremanName !== undefined) data.foremanName = body.foremanName || null
    if (body.amountCurrent !== undefined) data.amountCurrent = body.amountCurrent
    if (body.amountNext !== undefined) data.amountNext = body.amountNext
    if (body.contractStartDate !== undefined) data.contractStartDate = body.contractStartDate ? new Date(body.contractStartDate).toISOString() : null
    if (body.comment !== undefined) data.comment = body.comment || null

    const { data: obj, error } = await supabase
      .from("construction_object")
      .update(data)
      .eq("id", id)
      .select("id, addressId, contractId, contractNumber, kitNo, buildType, projectId, projectName, foremanId, foremanName, amountCurrent, amountNext, contractStartDate, comment, createdAt, updatedAt, address(*)")
      .single()

    if (error || !obj) {
      console.error("[PATCH /api/construction/objects/[id]]", error)
      return NextResponse.json({ error: "Ошибка обновления объекта" }, { status: 500 })
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
    console.error("[PATCH /api/construction/objects/[id]]", e)
    return NextResponse.json({ error: "Ошибка обновления объекта" }, { status: 500 })
  }
}

/** DELETE /api/construction/objects/[id] */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }
    const { id } = await params
    const { error } = await supabase.from("construction_object").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/construction/objects/[id]]", error)
      return NextResponse.json({ error: "Ошибка удаления объекта" }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/construction/objects/[id]]", e)
    return NextResponse.json({ error: "Ошибка удаления объекта" }, { status: 500 })
  }
}
