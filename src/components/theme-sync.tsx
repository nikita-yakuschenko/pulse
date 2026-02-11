"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { useUserPreferences } from "@/contexts/user-preferences-context"

/** Применяет сохранённую тему пользователя при загрузке настроек (синхронизация между устройствами). */
export function ThemeSync() {
  const { setTheme } = useTheme()
  const { preferences, isLoaded } = useUserPreferences()
  const applied = useRef(false)

  useEffect(() => {
    if (!isLoaded || applied.current) return
    const theme = preferences.theme
    if (theme === "light" || theme === "dark" || theme === "system") {
      setTheme(theme)
      applied.current = true
    }
  }, [isLoaded, preferences.theme, setTheme])

  return null
}
