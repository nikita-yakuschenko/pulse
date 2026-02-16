"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconStar, IconUsers } from "@tabler/icons-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SuppliersFrom1CTable } from "@/components/suppliers-from-1c-table"

const TAB_LOCAL_KEY = "pulse-pref:suppliers-view-tab"

function getInitialTab(): "favorites" | "suppliers" {
  if (typeof window === "undefined") return "favorites"
  try {
    const v = localStorage.getItem(TAB_LOCAL_KEY)
    if (v === "favorites" || v === "suppliers") return v
  } catch {
    // ignore
  }
  return "favorites"
}

/**
 * Раздел «Поставщики»: структура как в «Движение материалов» — две вкладки «Избранные» и «Поставщики».
 */
export function SuppliersView() {
  const [activeTab, setActiveTab] = React.useState<"favorites" | "suppliers">(getInitialTab)

  return (
    <div className="px-4 lg:px-6">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (v === "favorites" || v === "suppliers") {
            setActiveTab(v)
            try {
              if (typeof window !== "undefined") localStorage.setItem(TAB_LOCAL_KEY, v)
            } catch {
              // ignore
            }
          }
        }}
        className="w-full"
      >
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="favorites" className="gap-1.5">
              <IconStar className="size-4" />
              Избранные
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5">
              <IconUsers className="size-4" />
              Поставщики
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="favorites" className="mt-0">
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconStar className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Избранные поставщики</EmptyTitle>
                <EmptyDescription>
                  Добавляйте поставщиков в избранное из вкладки «Поставщики» для быстрого доступа.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </TabsContent>
        <TabsContent value="suppliers" className="mt-0">
          <SuppliersFrom1CTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
