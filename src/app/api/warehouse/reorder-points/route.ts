import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

/**
 * GET /api/warehouse/reorder-points
 * Получить все точки заказа текущего пользователя
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

    const { data: reorderPoints, error } = await supabase
      .from("reorder_point")
      .select("*")
      .eq("userId", user.id)
      .order("itemName", { ascending: true })

    if (error) {
      console.error("[GET /api/warehouse/reorder-points] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка загрузки точек заказа" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: reorderPoints || [] })
  } catch (error) {
    console.error("[GET /api/warehouse/reorder-points]", error)
    return NextResponse.json(
      { error: "Ошибка загрузки точек заказа" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/warehouse/reorder-points
 * Добавить или обновить точку заказа (одиночную или групповую)
 *
 * Одиночная: { itemCode, itemName, reorderQuantity, unit? }
 * Групповая: { isGroup: true, itemName, itemCodes: string[], reorderQuantity, unit? }
 *
 * Для редактирования существующей: { id, ... }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const {
      id,
      itemCode,
      itemName,
      reorderQuantity,
      unit,
      isGroup = false,
      itemCodes,
      warehouseCodes,
    } = body as {
      id?: string
      itemCode?: string
      itemName?: string
      reorderQuantity?: number
      unit?: string | null
      isGroup?: boolean
      itemCodes?: string[]
      warehouseCodes?: string[] | null
    }

    if (!itemName) {
      return NextResponse.json(
        { error: "Не указано название точки заказа" },
        { status: 400 }
      )
    }

    if (typeof reorderQuantity !== "number" || reorderQuantity <= 0) {
      return NextResponse.json(
        { error: "Точка заказа должна быть положительным числом" },
        { status: 400 }
      )
    }

    if (isGroup) {
      if (!Array.isArray(itemCodes) || itemCodes.length < 1) {
        return NextResponse.json(
          { error: "Выберите минимум 1 материал" },
          { status: 400 }
        )
      }
    } else {
      if (!itemCode) {
        return NextResponse.json(
          { error: "Не указан код номенклатуры" },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    // Если передан id — обновляем существующую запись
    if (id) {
      const { data, error } = await supabase
        .from("reorder_point")
        .update({
          itemName,
          reorderQuantity,
          unit: unit || null,
          isGroup,
          itemCode: isGroup ? "" : (itemCode ?? ""),
          itemCodes: isGroup ? itemCodes : null,
          warehouseCodes: Array.isArray(warehouseCodes) && warehouseCodes.length > 0 ? warehouseCodes : null,
          updatedAt: now,
        })
        .eq("id", id)
        .eq("userId", user.id)
        .select()
        .single()

      if (error) {
        console.error("[POST /api/warehouse/reorder-points] Update error:", error)
        return NextResponse.json(
          { error: "Ошибка обновления точки заказа" },
          { status: 500 }
        )
      }
      return NextResponse.json({ data })
    }

    // Для одиночных — проверяем дубликат по itemCode
    if (!isGroup) {
      const { data: existing } = await supabase
        .from("reorder_point")
        .select("id")
        .eq("itemCode", itemCode!)
        .eq("userId", user.id)
        .eq("isGroup", false)
        .maybeSingle()

      if (existing) {
        // Обновляем существующую запись
        const { data, error } = await supabase
          .from("reorder_point")
          .update({
            itemName,
            reorderQuantity,
            unit: unit || null,
            warehouseCodes: Array.isArray(warehouseCodes) && warehouseCodes.length > 0 ? warehouseCodes : null,
            updatedAt: now,
          })
          .eq("id", existing.id)
          .select()
          .single()

        if (error) {
          console.error("[POST /api/warehouse/reorder-points] Update error:", error)
          return NextResponse.json(
            { error: "Ошибка обновления точки заказа" },
            { status: 500 }
          )
        }
        return NextResponse.json({ data })
      }
    }

    // Создаём новую запись
    const { data, error } = await supabase
      .from("reorder_point")
      .insert({
        id: randomUUID(),
        itemCode: isGroup ? "" : (itemCode ?? ""),
        itemName,
        reorderQuantity,
        unit: unit || null,
        isGroup,
        itemCodes: isGroup ? itemCodes : null,
        warehouseCodes: Array.isArray(warehouseCodes) && warehouseCodes.length > 0 ? warehouseCodes : null,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (error) {
      console.error("[POST /api/warehouse/reorder-points] Insert error:", error)
      return NextResponse.json(
        { error: "Ошибка создания точки заказа" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[POST /api/warehouse/reorder-points]", error)
    return NextResponse.json(
      { error: "Ошибка сохранения точки заказа" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/warehouse/reorder-points
 * Удалить точку заказа по id или itemCode
 * Body: { id } или { itemCode }
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 })
    }

    const body = await request.json()
    const { id, itemCode } = body as { id?: string; itemCode?: string }

    if (!id && !itemCode) {
      return NextResponse.json({ error: "Не указан id или код номенклатуры" }, { status: 400 })
    }

    let query = supabase.from("reorder_point").delete().eq("userId", user.id)
    if (id) {
      query = query.eq("id", id)
    } else {
      query = query.eq("itemCode", itemCode!)
    }

    const { error } = await query

    if (error && error.code !== "PGRST116") {
      console.error("[DELETE /api/warehouse/reorder-points] Supabase error:", error)
      return NextResponse.json(
        { error: "Ошибка удаления точки заказа" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /api/warehouse/reorder-points]", error)
    return NextResponse.json(
      { error: "Ошибка удаления точки заказа" },
      { status: 500 }
    )
  }
}
