"use client"

import { useCallback, useEffect, useState } from "react"
import { useUserPreferences } from "@/contexts/user-preferences-context"

const DEFAULT_PAGE_SIZE = 17
const PAGE_SIZE_PRESETS = [17, 20, 50, 100, 200] as const

/**
 * Размер страницы и режим выбора (число / авто) из настроек пользователя — синхронизация между устройствами.
 * storageKey: например "specifications-page-size", "payments-page-size".
 */
export function useTablePageSizePreference(storageKey: string) {
  const { preferences, setPreference, isLoaded } = useUserPreferences()
  const keySelect = `${storageKey}-select`

  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE)
  const [pageSizeSelectValue, setPageSizeSelectValueState] = useState<string>("17")

  // После загрузки настроек подставляем сохранённые значения
  useEffect(() => {
    if (!isLoaded) return
    const saved = preferences[storageKey]
    const savedSelect = preferences[keySelect]
    if (typeof saved === "number" && saved >= 1 && saved <= 500) {
      setPageSizeState(saved)
      setPageSizeSelectValueState(
        typeof savedSelect === "string"
          ? savedSelect
          : PAGE_SIZE_PRESETS.includes(saved as (typeof PAGE_SIZE_PRESETS)[number])
            ? String(saved)
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
      setPreference(storageKey, clamped)
      setPreference(keySelect, selectValue)
    },
    [storageKey, keySelect, setPreference]
  )

  const setPageSizeSelectValue = useCallback(
    (value: string) => {
      setPageSizeSelectValueState(value)
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
