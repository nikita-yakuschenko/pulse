"use client"

import * as React from "react"
import Link from "next/link"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatUnit } from "@/lib/utils"

export type ReorderAlertItem = {
  id: string
  itemName: string
  itemCode: string
  itemCodes?: string[]
  isGroup: boolean
  currentQty: number
  reorderQuantity: number
  unit?: string | null
}

type NotificationItemProps = {
  item: ReorderAlertItem
}

function NotificationItem({ item }: NotificationItemProps) {
  const deficit = Math.max(0, Number(item.reorderQuantity) - item.currentQty)

  return (
    <div className="w-full py-4 first:pt-0 last:pb-0">
      <Link
        href="/dashboard/warehouse/balance?tab=reorder"
        className="flex gap-3 rounded-lg transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -m-2 p-2"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <IconAlertTriangle className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm">
              <span className="font-medium text-destructive">Достигнута точка заказа</span>
              <span className="text-muted-foreground"> — </span>
              <span className="font-medium">{item.itemName}</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-2.5 text-sm tracking-tight text-muted-foreground">
            Текущий остаток: {item.currentQty.toLocaleString("ru-RU")} {formatUnit(item.unit)}.
            Рекомендуется заказать не менее{" "}
            <span className="font-semibold text-foreground">
              {deficit.toLocaleString("ru-RU")} {formatUnit(item.unit)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}

export interface NotificationsMenuProps {
  /** Список алертов по точкам заказа (наступившая точка) */
  reorderAlerts: ReorderAlertItem[]
  /** Обновить список (например, при открытии меню) */
  onRefresh?: () => void
}

export function NotificationsMenu({ reorderAlerts, onRefresh }: NotificationsMenuProps) {
  const [activeTab, setActiveTab] = React.useState<string>("all")
  const count = reorderAlerts.length

  const filtered =
    activeTab === "reorder" ? reorderAlerts : reorderAlerts

  return (
    <Card className="flex w-full max-w-[520px] flex-col gap-6 border-0 shadow-none p-0 md:max-w-[380px]">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold leading-none tracking-tight">
            Уведомления
          </h3>
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={(e) => {
                e.preventDefault()
                onRefresh()
              }}
              aria-label="Обновить уведомления"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                className="size-4.5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mt-3 h-9 w-full justify-start rounded-lg bg-muted p-1">
            <TabsTrigger value="all" className="gap-1.5 rounded-md px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Все
              <Badge variant="secondary" className="size-5 rounded-full px-1 text-[10px] font-medium">
                {count}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="reorder" className="gap-1.5 rounded-md px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Точки заказа
              <Badge variant="secondary" className="size-5 rounded-full px-1 text-[10px] font-medium">
                {count}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="h-full p-0">
        <div className="divide-y divide-dashed divide-border">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <NotificationItem key={item.id} item={item} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <IconAlertTriangle className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Нет уведомлений
              </p>
              <p className="text-xs text-muted-foreground">
                Здесь появятся алерты по точкам заказа и другим разделам
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/warehouse/balance?tab=reorder">
                  Перейти к точкам заказа
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
