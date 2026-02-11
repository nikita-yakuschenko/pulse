"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconBell } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationsMenu, type ReorderAlertItem } from "@/components/ui/notifications-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Метки сегментов пути
const pathToLabel: Record<string, string> = {
  dashboard: "Панель управления",
  plan: "График производства",
  analytics: "Аналитика",
  sorders: "Заказы поставщикам",
  payments: "Заявки на оплату",
  receipts: "Поступления",
  settings: "Настройки",
  production: "Производство",
  painting: "Покрасочный цех",
  construction: "Строительная часть",
  schedule: "График монтажа",
  objects: "Объекты",
  suppliers: "Поставщики",
  contracts: "Договоры",
  invoices: "Счета",
  docs: "Документация",
  projects: "Проекты (ЭП, КР)",
  specifications: "Спецификации",
}

// Три основных раздела — стартовые точки в роутинге
const SECTIONS = {
  procurement: { label: "Закупки и снабжение", href: "/purchases/dashboard" },
  production: { label: "Производство", href: "/dashboard/plan" },
  construction: { label: "Строительная часть", href: "/construction/schedule" },
  warehouse: { label: "Склад", href: "/dashboard/warehouse/balance" },
} as const

// Подразделы «Закупки и снабжение»
const PROCUREMENT_SUBSECTIONS: Record<string, { label: string; href: string }> = {
  procurement: { label: "Закупки", href: "/purchases/dashboard" },
  suppliers: { label: "Поставщики", href: "/dashboard/suppliers/contracts" },
  docs: { label: "Документация", href: "/docs/projects" },
}

// Подразделы «Склад»
const WAREHOUSE_SUBSECTIONS: Record<string, { label: string; href: string }> = {
  balance: { label: "Складские остатки", href: "/dashboard/warehouse/balance" },
  material: { label: "Номенклатура", href: "/dashboard/warehouse/materials" },
}

function getBreadcrumbs(pathname: string): { href: string; label: string; isLast: boolean }[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return []

  let section: { label: string; href: string } | null = null
  const items: { href: string; label: string }[] = []

  if (pathname.startsWith("/construction")) {
    section = SECTIONS.construction
    if (segments[1] === "schedule") items.push({ href: "/construction/schedule", label: "График монтажа" })
    else if (segments[1] === "objects") items.push({ href: "/construction/objects", label: "Объекты" })
  } else if (pathname.startsWith("/dashboard/warehouse")) {
    section = SECTIONS.warehouse
    const sub = WAREHOUSE_SUBSECTIONS[segments[2]]
    if (sub) items.push({ href: sub.href, label: sub.label })
    else items.push({ href: pathname, label: pathToLabel[segments[2]] ?? segments[2] ?? "Склад" })
  } else if (pathname.startsWith("/dashboard/production") || pathname === "/dashboard/plan") {
    section = SECTIONS.production
    if (pathname === "/dashboard/plan") items.push({ href: "/dashboard/plan", label: "График производства" })
    else if (segments[2] === "painting") items.push({ href: "/dashboard/production/painting", label: "Покрасочный цех" })
  } else if (pathname.startsWith("/purchases")) {
    section = SECTIONS.procurement
    items.push(PROCUREMENT_SUBSECTIONS.procurement)
    const page = segments[1]
    items.push({ href: pathname, label: pathToLabel[page] ?? page ?? "Закупки" })
  } else if (pathname.startsWith("/docs")) {
    section = SECTIONS.procurement
    items.push(PROCUREMENT_SUBSECTIONS.docs)
    const page = segments[1]
    items.push({ href: pathname, label: pathToLabel[page] ?? page ?? "Документация" })
  } else if (pathname.startsWith("/dashboard")) {
    section = SECTIONS.procurement
    const page = segments[1] ?? segments[0]
    if (page === "suppliers") {
      items.push(PROCUREMENT_SUBSECTIONS.suppliers)
      items.push({
        href: pathname,
        label: pathToLabel[segments[2]] ?? segments[2],
      })
    } else {
      items.push(PROCUREMENT_SUBSECTIONS.procurement)
      const label = pathToLabel[page] ?? page
      items.push({ href: pathname, label })
    }
  }

  if (!section) return []

  const result: { href: string; label: string; isLast: boolean }[] = [
    { ...section, isLast: false },
    ...items.map((item, i) => ({ ...item, isLast: i === items.length - 1 })),
  ]
  return result
}

export function SiteHeader() {
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)
  const [alerts, setAlerts] = React.useState<{ count: number; items: ReorderAlertItem[] }>({
    count: 0,
    items: [],
  })

  const fetchAlerts = React.useCallback(() => {
    const url = "/api/warehouse/reorder-alerts"
    const onFail = () => {
      /* ошибки сети / ERR_CONNECTION_REFUSED / расширения — не показываем, не бросаем */
    }
    try {
      fetch(url)
        .then((r) => r.json())
        .then((json) => {
          if (json?.error) return
          setAlerts({ count: json.count ?? 0, items: json.items ?? [] })
        })
        .catch(onFail)
    } catch (_) {
      onFail()
    }
  }, [])

  React.useEffect(() => {
    fetchAlerts()

    // Периодическое обновление (каждые 15 сек) — уведомление появляется без перезагрузки
    const interval = setInterval(fetchAlerts, 15_000)

    // Обновление при возврате на вкладку
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchAlerts()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Мгновенное обновление при изменении точек заказа на странице склада
    const onWarehouseUpdate = () => fetchAlerts()
    window.addEventListener("warehouse-reorder-updated", onWarehouseUpdate)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("warehouse-reorder-updated", onWarehouseUpdate)
    }
  }, [fetchAlerts])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Модуль.Пульс</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                {breadcrumbs.map((item, idx) => (
                  <span key={`${idx}-${item.label}`} className="contents">
                    {idx > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {item.isLast ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu onOpenChange={(open) => open && fetchAlerts()}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative"
                aria-label="Уведомления"
              >
                <IconBell className="size-5" />
                {alerts.count > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 size-4 p-0 text-[10px] leading-none"
                  >
                    {alerts.count > 99 ? "99+" : alerts.count}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(90vw,400px)] p-2">
              <NotificationsMenu
                reorderAlerts={alerts.items}
                onRefresh={fetchAlerts}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
