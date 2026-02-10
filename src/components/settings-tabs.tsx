"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { MfaSettings } from "@/components/mfa-settings"
import { ProfileSettings } from "@/components/profile-settings"
import { IntegrationsSettings } from "@/components/integrations-settings"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type TabValue = "profile" | "security" | "appearance" | "integrations"

const tabs = [
  { id: "profile" as const, label: "Профиль" },
  { id: "security" as const, label: "Безопасность" },
  { id: "appearance" as const, label: "Оформление" },
  { id: "integrations" as const, label: "Интеграции" },
]

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>("profile")
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="w-full flex-col justify-start gap-6">
      {/* Animated Tab Buttons */}
      <div className="bg-muted flex h-9 w-full items-center rounded-lg p-1 text-muted-foreground">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              activeTab === tab.id ? "text-foreground" : ""
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabIndicator"
                className="bg-background absolute inset-0 rounded-md shadow-sm"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 30 }
                }
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      
      {/* Content without animations */}
      <div className="mt-6">
        {activeTab === "profile" && (
          <div className="flex flex-col">
            <ProfileSettings />
          </div>
        )}
        
        {activeTab === "security" && (
          <div className="flex flex-col">
            <MfaSettings />
          </div>
        )}
        
        {activeTab === "appearance" && (
          <div className="flex flex-col">
            <Card>
              <CardHeader>
                <CardTitle>Оформление</CardTitle>
                <CardDescription>
                  Тема интерфейса и отображение
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm text-muted-foreground">Тема</span>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === "integrations" && (
          <div className="flex flex-col">
            <IntegrationsSettings />
          </div>
        )}
      </div>
    </div>
  )
}
