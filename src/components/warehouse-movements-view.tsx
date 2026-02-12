"use client"

import * as React from "react"
import {
  IconArrowsExchange,
  IconFileText,
  IconPlus,
} from "@tabler/icons-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useUserPreferences } from "@/contexts/user-preferences-context"

const TAB_PREFERENCE_KEY = "warehouse-movements-tab"

export function WarehouseMovementsView() {
  const { preferences, setPreference, isLoaded: prefsLoadedTab } = useUserPreferences()
  const [activeTab, setActiveTabState] = React.useState<"requirements" | "transfers">("requirements")
  const [loading, setLoading] = React.useState(false)
  
  const activeTabSynced = React.useRef(false)
  React.useEffect(() => {
    if (!prefsLoadedTab || activeTabSynced.current) return
    const saved = preferences[TAB_PREFERENCE_KEY]
    if (saved === "requirements" || saved === "transfers") {
      setActiveTabState(saved)
      activeTabSynced.current = true
    }
  }, [prefsLoadedTab, preferences])

  const setActiveTab = React.useCallback(
    (v: "requirements" | "transfers") => {
      setActiveTabState(v)
      setPreference(TAB_PREFERENCE_KEY, v)
    },
    [setPreference]
  )

  // TODO: Загрузка данных из 1С API (когда endpoints будут готовы)
  // const [requirements, setRequirements] = React.useState([])
  // const [transfers, setTransfers] = React.useState([])

  return (
    <div className="px-4 lg:px-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === "requirements" || v === "transfers") setActiveTab(v)
          }}
          className="w-full"
        >
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="requirements">Требования-накладные</TabsTrigger>
              <TabsTrigger value="transfers">Перемещения</TabsTrigger>
            </TabsList>
            <Button size="sm" className="shrink-0" disabled>
              <IconPlus className="h-4 w-4" />
              Создать документ
            </Button>
          </div>

          <TabsContent value="requirements" className="mt-0">
            <div className="rounded-lg border overflow-hidden">
              <div className="w-full min-h-[280px] flex items-center justify-center">
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconFileText className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>Требования-накладные</EmptyTitle>
                    <EmptyDescription>
                      Функционал в разработке. Здесь будут отображаться требования-накладные на отпуск материалов
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <p className="text-xs text-muted-foreground">
                      API endpoint: <code className="bg-muted px-1 py-0.5 rounded">GET /api/1c/warehouse/requirements</code>
                    </p>
                  </EmptyContent>
                </Empty>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="mt-0">
            <div className="rounded-lg border overflow-hidden">
              <div className="w-full min-h-[280px] flex items-center justify-center">
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconArrowsExchange className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>Перемещения материалов</EmptyTitle>
                    <EmptyDescription>
                      Функционал в разработке. Здесь будут отображаться перемещения материалов между складами
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <p className="text-xs text-muted-foreground">
                      API endpoint: <code className="bg-muted px-1 py-0.5 rounded">GET /api/1c/warehouse/transfers</code>
                    </p>
                  </EmptyContent>
                </Empty>
              </div>
            </div>
          </TabsContent>
        </Tabs>
    </div>
  )
}
