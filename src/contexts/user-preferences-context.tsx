"use client"

import React, { useCallback, useEffect, useState } from "react"

export type UserPreferences = Record<string, string | number | boolean>

type ContextValue = {
  preferences: UserPreferences
  setPreference: (key: string, value: string | number | boolean) => Promise<void>
  isLoaded: boolean
}

const UserPreferencesContext = React.createContext<ContextValue | null>(null)

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/profile/preferences")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) {
          setPreferences(typeof data === "object" && data !== null ? data : {})
          setIsLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setPreference = useCallback(async (key: string, value: string | number | boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        const data = await fetch("/api/profile/preferences").then((r) => (r.ok ? r.json() : {}))
        setPreferences(typeof data === "object" && data !== null ? data : {})
      }
    } catch {
      const data = await fetch("/api/profile/preferences").then((r) => (r.ok ? r.json() : {}))
      setPreferences(typeof data === "object" && data !== null ? data : {})
    }
  }, [])

  const value: ContextValue = { preferences, setPreference, isLoaded }

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): ContextValue {
  const ctx = React.useContext(UserPreferencesContext)
  if (!ctx) {
    return {
      preferences: {},
      setPreference: async () => {},
      isLoaded: false,
    }
  }
  return ctx
}
