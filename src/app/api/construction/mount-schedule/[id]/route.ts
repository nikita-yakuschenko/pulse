import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmountDisplay, getStatusSummary, getAddressDisplay } from "../../mount-schedule-utils"

/** PATCH /api/construction/mount-schedule/[id] */
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

    let addressId: string | null | undefined = (body.addressId as string)?.trim() || undefined
    const addressPayload = body.address as Record<string, unknown> | null | undefined
    if (addressPayload && typeof addressPayload === "object") {
      const { data: addr, error: addrError } = await supabase
        .from("address")
        .insert({
          id: randomUUID(),
          region: (addressPayload.region as string) || undefined,
          district: (addressPayload.district as string) || undefined,
          locality: (addressPayload.locality as string) || undefined,
          street: (addressPayload.street as string) || undefined,
          house: (addressPayload.house as string) || undefined,
          fullText: (addressPayload.fullText as string) || undefined,
          kladrCode: (addressPayload.kladrCode as string) || undefined,
          fiasId: (addressPayload.fiasId as string) || undefined,
          isCustom: addressPayload.isCustom === true,
          updatedAt: new Date().toISOString(),
        })
        .select("id")
        .single()
      if (addrError || !addr) {
        console.error("[PATCH /api/construction/mount-schedule/[id]] address insert", addrError)
        return NextResponse.json({ error: "Не удалось сохранить адрес" }, { status: 500 })
      }
      addressId = addr.id
    }

    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (body.planMonth != null) {
      const [y, m] = String(body.planMonth).split("-").map(Number)
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        data.planMonth = new Date(Date.UTC(y, m - 1, 1)).toISOString()
      }
    }
    if (body.contractId !== undefined) data.contractId = body.contractId || null
    if (body.contractNumber !== undefined) data.contractNumber = body.contractNumber
    if (body.kitNo !== undefined) data.kitNo = body.kitNo != null ? body.kitNo : null
    if (addressId !== undefined) data.addressId = addressId ?? null
    if (body.buildType !== undefined) data.buildType = body.buildType || null
    if (body.projectId !== undefined) data.projectId = body.projectId || null
    if (body.projectName !== undefined) data.projectName = body.projectName || null
    if (body.foremanId !== undefined) data.foremanId = body.foremanId || null
    if (body.foremanName !== undefined) data.foremanName = body.foremanName || null
    if (body.amountCurrent !== undefined) data.amountCurrent = body.amountCurrent
    if (body.amountNext !== undefined) data.amountNext = body.amountNext
    if (body.productionLaunchDate !== undefined) data.productionLaunchDate = body.productionLaunchDate ? new Date(body.productionLaunchDate).toISOString() : null
    if (body.productionStatus !== undefined) data.productionStatus = body.productionStatus || null
    if (body.shipmentDate !== undefined) data.shipmentDate = body.shipmentDate ? new Date(body.shipmentDate).toISOString() : null
    if (body.roofWorkDate !== undefined) data.roofWorkDate = body.roofWorkDate ? new Date(body.roofWorkDate).toISOString() : null
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? new Date(body.handoverDate).toISOString() : null
    if (body.mountStartDate !== undefined) data.mountStartDate = body.mountStartDate ? new Date(body.mountStartDate).toISOString() : null
    if (body.statusSummaryOverride !== undefined) data.statusSummaryOverride = body.statusSummaryOverride || null
    if (body.comment !== undefined) data.comment = body.comment || null
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder != null ? body.sortOrder : null

    const { data: entry, error } = await supabase
      .from("mount_schedule_entry")
      .update(data)
      .eq("id", id)
      .select("id, planMonth, contractNumber, addressId, amountCurrent, amountNext, statusSummaryOverride, productionStatus, productionLaunchDate, mountStartDate, address(*)")
      .single()

    if (error || !entry) {
      console.error("[PATCH /api/construction/mount-schedule/[id]]", error)
      return NextResponse.json({ error: "Ошибка обновления записи" }, { status: 500 })
    }

    const addr = Array.isArray(entry.address) ? entry.address[0] : entry.address
    return NextResponse.json({
      id: entry.id,
      planMonth: (entry.planMonth as string)?.slice(0, 7) ?? "",
      contractNumber: entry.contractNumber,
      addressDisplay: getAddressDisplay(addr as Record<string, unknown> | null),
      amountDisplay: getAmountDisplay(entry as Record<string, unknown>),
      statusSummary: getStatusSummary(entry as Record<string, unknown>),
    })
  } catch (e) {
    console.error("[PATCH /api/construction/mount-schedule/[id]]", e)
    return NextResponse.json({ error: "Ошибка обновления записи" }, { status: 500 })
  }
}

/** DELETE /api/construction/mount-schedule/[id] */
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
    const { error } = await supabase.from("mount_schedule_entry").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/construction/mount-schedule/[id]]", error)
      return NextResponse.json({ error: "Ошибка удаления записи" }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/construction/mount-schedule/[id]]", e)
    return NextResponse.json({ error: "Ошибка удаления записи" }, { status: 500 })
  }
}
