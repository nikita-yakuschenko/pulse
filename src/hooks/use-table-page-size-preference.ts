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
 * Источник истины при загрузке — БД (ответ GET /api/profile/preferences), чтобы не зависеть от порядка монтирования вкладок и localStorage.
 * При выборе значение пишется в сервер (PATCH) и в localStorage (оптимистичный UI до ответа).
 */
export function useTablePageSizePreference(storageKey: string) {
  const { preferences, setPreference, isLoaded } = useUserPreferences()
  const keySelect = `${storageKey}-select`

  // При монтировании сразу читаем из localStorage — состояние «Авто»/число не теряется при переходе на другую страницу и возврате
  const [pageSizeSelectValue, setPageSizeSelectValueState] = useState<string>(() => {
    if (typeof window === "undefined") return "17"
    const v = getLocalSelect(keySelect)
    return v ?? "17"
  })
  const [pageSize, setPageSizeState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PAGE_SIZE
    const v = getLocalSelect(keySelect)
    if (v === "auto" || v === "custom") return DEFAULT_PAGE_SIZE
    const n = Number(v)
    if (!Number.isNaN(n) && n >= 1 && n <= 500) return n
    return DEFAULT_PAGE_SIZE
  })

  // Дотягиваем число из localStorage, если там число (первый эффект оставляем для согласованности pageSize с выбором)
  useEffect(() => {
    const local = getLocalSelect(keySelect)
    if (!local || local === "auto" || local === "custom") return
    const n = Number(local)
    if (!Number.isNaN(n) && n >= 1 && n <= 500) setPageSizeState(n)
  }, [keySelect])

  // После загрузки настроек с сервера: приоритет у БД (preferences), иначе localStorage.
  // Если в localStorage уже «Авто»/«Своё» — не перезаписывать из preferences (важно после ухода на другую страницу и возврата, когда компонент монтируется заново).
  useEffect(() => {
    if (!isLoaded) return
    const localSelect = getLocalSelect(keySelect)
    if (localSelect === "auto" || localSelect === "custom") {
      setPageSizeSelectValueState(localSelect)
    }
    const raw = preferences[storageKey]
    const savedSelect = preferences[keySelect] ?? localSelect ?? getLocalSelect(keySelect)
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
      if (localSelect !== "auto" && localSelect !== "custom") {
        setPageSizeSelectValueState(
          typeof savedSelect === "string"
            ? savedSelect
            : PAGE_SIZE_PRESETS.includes(num as (typeof PAGE_SIZE_PRESETS)[number])
              ? String(num)
              : "custom"
        )
      }
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
