"use client"

import { useCallback, useEffect, useState } from "react"
import { useUserPreferences } from "@/contexts/user-preferences-context"

const DEFAULT_PAGE_SIZE = 17
const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200] as const
const LOCAL_PREFIX = "pulse-pref:"

function getLocalSelect(keySelect: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(LOCAL_PREFIX + keySelect)
    return typeof v === "string" && v !== "" ? v : null
  } catch {
    return null
  }
}

/**
 * Размер страницы и режим выбора (число / авто) из настроек пользователя — синхронизация между устройствами.
 * При выборе значение пишется в сервер и в localStorage; при загрузке берётся с сервера, при отсутствии — из localStorage (чтобы перезагрузка не сбрасывала значение до завершения PATCH).
 */
export function useTablePageSizePreference(storageKey: string) {
  const { preferences, setPreference, isLoaded } = useUserPreferences()
  const keySelect = `${storageKey}-select`

  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE)
  const [pageSizeSelectValue, setPageSizeSelectValueState] = useState<string>("17")

  // Сразу после монтирования на клиенте подставляем значение из localStorage (при SSR его нет — будет «17» до гидрации)
  useEffect(() => {
    const local = getLocalSelect(keySelect)
    if (!local) return
    if (local === "auto" || local === "custom") {
      setPageSizeSelectValueState(local)
      return
    }
    const n = Number(local)
    if (!Number.isNaN(n) && n >= 1 && n <= 500) {
      setPageSizeSelectValueState(local)
      setPageSizeState(n)
    }
  }, [keySelect])

  // После загрузки настроек: для выбора (Авто/число) приоритет у localStorage (последнее действие пользователя), иначе сервер
  useEffect(() => {
    if (!isLoaded) return
    const raw = preferences[storageKey]
    const savedSelect = getLocalSelect(keySelect) ?? preferences[keySelect]
    const savedNum =
      typeof raw === "number" && !Number.isNaN(raw)
        ? raw
        : typeof raw === "string" && raw !== ""
          ? Number(raw)
          : null
    let num = savedNum != null && savedNum >= 1 && savedNum <= 500 ? savedNum : null
    if (num == null && typeof savedSelect === "string" && savedSelect !== "auto" && savedSelect !== "custom") {
      const fromSelect = Number(savedSelect)
      if (!Number.isNaN(fromSelect) && fromSelect >= 1 && fromSelect <= 500) num = fromSelect
    }
    if (num != null) {
      setPageSizeState(num)
      setPageSizeSelectValueState(
        typeof savedSelect === "string"
          ? savedSelect
          : PAGE_SIZE_PRESETS.includes(num as (typeof PAGE_SIZE_PRESETS)[number])
            ? String(num)
            : "custom"
      )
    }
    if (typeof savedSelect === "string" && savedSelect === "auto") {
      setPageSizeSelectValueState("auto")
    }
  }, [isLoaded, preferences[storageKey], preferences[keySelect], storageKey, keySelect])

  const setPageSizeAndSave = useCallback(
    (n: number) => {
      const clamped = Math.max(1, Math.min(500, n))
      setPageSizeState(clamped)
      const selectValue = PAGE_SIZE_PRESETS.includes(clamped as (typeof PAGE_SIZE_PRESETS)[number])
        ? String(clamped)
        : "custom"
      setPageSizeSelectValueState(selectValue)
      try {
        if (typeof window !== "undefined") localStorage.setItem(LOCAL_PREFIX + keySelect, selectValue)
      } catch {
        // ignore
      }
      setPreference(storageKey, clamped)
      setPreference(keySelect, selectValue)
    },
    [storageKey, keySelect, setPreference]
  )

  const setPageSizeSelectValue = useCallback(
    (value: string) => {
      setPageSizeSelectValueState(value)
      try {
        if (typeof window !== "undefined") localStorage.setItem(LOCAL_PREFIX + keySelect, value)
      } catch {
        // ignore
      }
      setPreference(keySelect, value)
    },
    [keySelect, setPreference]
  )

  return {
    pageSize,
    pageSizeSelectValue,
    setPageSizeAndSave,
    setPageSizeSelectValue,
    isLoaded,
    PAGE_SIZE_PRESETS: PAGE_SIZE_PRESETS as unknown as number[],
  }
}
