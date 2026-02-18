import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmountDisplay, getStatusSummary, getAddressDisplay } from "../mount-schedule-utils"

/** GET /api/construction/mount-schedule?planMonth=YYYY-MM&address=...&type=...&foreman=...&page=1&pageSize=20 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planMonth = searchParams.get("planMonth")
    const addressFilter = searchParams.get("address")?.trim() || undefined
    const typeFilter = searchParams.get("type")?.trim() || undefined
    const foremanFilter = searchParams.get("foreman")?.trim() || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20))

    let planMonthStart: Date
    if (planMonth) {
      const [y, m] = planMonth.split("-").map(Number)
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        planMonthStart = new Date(Date.UTC(y, m - 1, 1))
      } else {
        const now = new Date()
        planMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
      }
    } else {
      const now = new Date()
      planMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    }
    const nextMonth = new Date(planMonthStart)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const planMonthEnd = nextMonth.toISOString()
    const planMonthStartStr = planMonthStart.toISOString()

    let query = supabase
      .from("mount_schedule_entry")
      .select("*, address(*)", { count: "exact" })
      .gte("planMonth", planMonthStartStr)
      .lt("planMonth", planMonthEnd)
    if (typeFilter && typeFilter !== "all") {
      query = query.eq("buildType", typeFilter)
    }
    if (foremanFilter && foremanFilter !== "all") {
      query = query.eq("foremanId", foremanFilter)
    }
    if (addressFilter && addressFilter !== "all") {
      query = query.eq("addressId", addressFilter)
    }
    const { data: rows, error, count } = await query
      .order("sortOrder", { ascending: true, nullsFirst: true })
      .order("contractNumber", { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (error) {
      console.error("[GET /api/construction/mount-schedule]", error)
      return NextResponse.json({ error: "Ошибка загрузки графика" }, { status: 500 })
    }

    const items = (rows ?? []).map((row: Record<string, unknown>) => {
      const addr = Array.isArray(row.address) ? row.address[0] : row.address
      const planMonthVal = row.planMonth as string
      return {
        id: row.id,
        planMonth: planMonthVal?.slice(0, 7) ?? "",
        contractId: row.contractId,
        contractNumber: row.contractNumber,
        houseNo: row.houseNo,
        addressId: row.addressId,
        addressDisplay: getAddressDisplay(addr as Record<string, unknown> | null),
        buildType: row.buildType,
        projectId: row.projectId,
        projectName: row.projectName,
        foremanId: row.foremanId,
        foremanName: row.foremanName,
        amountDisplay: getAmountDisplay(row),
        amountCurrent: row.amountCurrent != null ? Number(row.amountCurrent) : null,
        amountNext: row.amountNext != null ? Number(row.amountNext) : null,
        productionLaunchDate: planMonthVal ? (row.productionLaunchDate as string)?.slice(0, 10) ?? null : null,
        shipmentDate: (row.shipmentDate as string)?.slice(0, 10) ?? null,
        roofWorkDate: (row.roofWorkDate as string)?.slice(0, 10) ?? null,
        handoverDate: (row.handoverDate as string)?.slice(0, 10) ?? null,
        statusSummary: getStatusSummary(row),
        statusSummaryOverride: row.statusSummaryOverride,
        productionStatus: row.productionStatus,
        comment: row.comment,
        sortOrder: row.sortOrder,
        createdAt: (row.createdAt as string) ?? "",
        updatedAt: (row.updatedAt as string) ?? "",
      }
    })

    return NextResponse.json({ items, total: count ?? 0 })
  } catch (e) {
    console.error("[GET /api/construction/mount-schedule]", e)
    return NextResponse.json({ error: "Ошибка загрузки графика" }, { status: 500 })
  }
}

/** POST /api/construction/mount-schedule — создание записи */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const planMonthStr = body.planMonth as string | undefined
    const contractNumber = (body.contractNumber as string)?.trim()
    if (!planMonthStr || !contractNumber) {
      return NextResponse.json(
        { error: "Укажите план-месяц (planMonth) и номер договора (contractNumber)" },
        { status: 400 }
      )
    }

    const [y, m] = planMonthStr.split("-").map(Number)
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: "Некорректный план-месяц (YYYY-MM)" }, { status: 400 })
    }
    const planMonth = new Date(Date.UTC(y, m - 1, 1)).toISOString()

    let addressId: string | null = (body.addressId as string)?.trim() || null
    const addressPayload = body.address as Record<string, unknown> | null | undefined
    if (addressPayload && typeof addressPayload === "object") {
      const { data: addr, error: addrError } = await supabase
        .from("address")
        .insert({
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
        console.error("[POST /api/construction/mount-schedule] address insert", addrError)
        return NextResponse.json({ error: "Не удалось сохранить адрес" }, { status: 500 })
      }
      addressId = addr.id
    }

    const { data: entry, error } = await supabase
      .from("mount_schedule_entry")
      .insert({
        planMonth,
        contractId: (body.contractId as string) || null,
        contractNumber,
        houseNo: typeof body.houseNo === "number" ? body.houseNo : body.houseNo != null ? parseInt(String(body.houseNo), 10) : null,
        addressId: addressId ?? null,
        buildType: (body.buildType as string) || null,
        projectId: (body.projectId as string) || null,
        projectName: (body.projectName as string) || null,
        foremanId: (body.foremanId as string) || null,
        foremanName: (body.foremanName as string) || null,
        amountCurrent: body.amountCurrent != null ? body.amountCurrent : null,
        amountNext: body.amountNext != null ? body.amountNext : null,
        productionLaunchDate: body.productionLaunchDate ? new Date(body.productionLaunchDate).toISOString() : null,
        productionStatus: (body.productionStatus as string) || null,
        shipmentDate: body.shipmentDate ? new Date(body.shipmentDate).toISOString() : null,
        roofWorkDate: body.roofWorkDate ? new Date(body.roofWorkDate).toISOString() : null,
        handoverDate: body.handoverDate ? new Date(body.handoverDate).toISOString() : null,
        statusSummaryOverride: (body.statusSummaryOverride as string) || null,
        comment: (body.comment as string) || null,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : body.sortOrder != null ? parseInt(String(body.sortOrder), 10) : null,
        updatedAt: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error || !entry) {
      console.error("[POST /api/construction/mount-schedule]", error)
      return NextResponse.json({ error: "Ошибка создания записи" }, { status: 500 })
    }
    return NextResponse.json({ id: entry.id })
  } catch (e) {
    console.error("[POST /api/construction/mount-schedule]", e)
    return NextResponse.json({ error: "Ошибка создания записи" }, { status: 500 })
  }
}
