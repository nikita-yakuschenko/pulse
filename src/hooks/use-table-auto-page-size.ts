"use client"

import { useEffect, useState, type RefObject } from "react"

const ROW_HEIGHT_PX = 40
const TABLE_HEADER_ROW_PX = 40
const PAGINATION_OFFSET_PX = 100
const DESKTOP_MIN_WIDTH = 1024
const MIN_ROWS = 5
const MAX_AUTO_ROWS = 100

/**
 * На десктопе возвращает число строк таблицы, умещающихся в видимую высоту вьюпорта.
 * Контейнер (ref) — блок с таблицей; по его getBoundingClientRect().top считаем доступную высоту.
 */
export function useTableAutoPageSize(
  containerRef: RefObject<HTMLElement | null>,
  options?: {
    rowHeightPx?: number
    offsetBottomPx?: number
    desktopMinWidthPx?: number
  }
): number {
  const rowHeight = options?.rowHeightPx ?? ROW_HEIGHT_PX
  const offsetBottom = options?.offsetBottomPx ?? PAGINATION_OFFSET_PX
  const desktopMin = options?.desktopMinWidthPx ?? DESKTOP_MIN_WIDTH

  const [autoPageSize, setAutoPageSize] = useState(0)

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < desktopMin) {
        setAutoPageSize(0)
        return
      }
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const availableHeight = window.innerHeight - rect.top - offsetBottom
      const bodyHeight = Math.max(0, availableHeight - TABLE_HEADER_ROW_PX)
      const rows = Math.floor(bodyHeight / rowHeight)
      const clamped = Math.min(MAX_AUTO_ROWS, Math.max(MIN_ROWS, rows))
      setAutoPageSize(clamped)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [containerRef, rowHeight, offsetBottom, desktopMin])

  return autoPageSize
}
