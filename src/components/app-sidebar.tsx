"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconBuildingWarehouse,
  IconCalendar,
  IconListNumbers,
  IconChevronRight,
  IconFileText,
  IconLayoutDashboard,
  IconMapPin,
  IconPalette,
  IconPlanet,
  IconShoppingCart,
  IconUsers,
} from "@tabler/icons-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const teams = [
  { name: "Модуль.Пульс", logo: IconLayoutDashboard, plan: "Основная организация" },
]

const ENABLED_URLS = new Set([
  "/purchases/dashboard",
  "/purchases/analytics",
  "/purchases/sorders",
  "/purchases/payments",
  "/purchases/receipts",
  "/docs/specifications",
  "/docs/projects",
  "/dashboard/warehouse/balance",
  "/dashboard/warehouse/materials",
  "/construction/schedule",
])

const procurementCollapsibleItems = [
  {
    title: "Закупки",
    icon: IconShoppingCart,
    isActive: true,
    items: [
      { title: "Панель управления", url: "/purchases/dashboard" },
      { title: "Аналитика", url: "/purchases/analytics" },
      { title: "Заказы поставщикам", url: "/purchases/sorders" },
      { title: "Заявки на оплату", url: "/purchases/payments" },
      { title: "Поступления", url: "/purchases/receipts" },
    ],
  },
  {
    title: "Поставщики",
    icon: IconUsers,
    items: [
      { title: "Договоры", url: "/dashboard/suppliers/contracts" },
      { title: "Счета", url: "/dashboard/suppliers/invoices" },
    ],
  },
  {
    title: "Документация",
    icon: IconFileText,
    items: [
      { title: "Проекты (ЭП, КР)", url: "/docs/projects" },
      { title: "Спецификации", url: "/docs/specifications" },
    ],
  },
]

const productionItems = [
  { title: "График производства", url: "/dashboard/plan", icon: IconPlanet },
  { title: "Покрасочный цех", url: "/dashboard/production/painting", icon: IconPalette },
]

const constructionItems = [
  { title: "График монтажа", url: "/construction/schedule", icon: IconCalendar },
  { title: "Объекты", url: "/construction/objects", icon: IconMapPin },
]

const warehouseItems = [
  { title: "Складские остатки", url: "/dashboard/warehouse/balance", icon: IconBuildingWarehouse },
  { title: "Номенклатура", url: "/dashboard/warehouse/materials", icon: IconListNumbers },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar?: string } | null
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Закупки и снабжение</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {procurementCollapsibleItems.map((item) => {
                const hasActiveSub = item.items.some((s) => pathname === s.url || (s.url === "/purchases/analytics" && pathname.startsWith("/purchases/analytics")))
                return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.isActive || hasActiveSub}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title}>
                        <item.icon />
                        <span>{item.title}</span>
                        <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => {
                          const enabled = ENABLED_URLS.has(subItem.url)
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {enabled ? (
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.url || (subItem.url === "/purchases/analytics" && pathname.startsWith("/purchases/analytics"))}
                                >
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              ) : (
                                <SidebarMenuSubButton disabled isActive={false} className="opacity-50 cursor-not-allowed">
                                  <span>{subItem.title}</span>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Склад</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {warehouseItems.map((item) => {
                const enabled = ENABLED_URLS.has(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    {enabled ? (
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton disabled tooltip={item.title} className="opacity-50 cursor-not-allowed">
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Производство</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productionItems.map((item) => {
                const enabled = ENABLED_URLS.has(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    {enabled ? (
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton disabled tooltip={item.title} className="opacity-50 cursor-not-allowed">
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Строительная часть</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {constructionItems.map((item) => {
                const enabled = ENABLED_URLS.has(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    {enabled ? (
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton disabled tooltip={item.title} className="opacity-50 cursor-not-allowed">
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={
            user
              ? { name: user.name, email: user.email, avatar: user.avatar ?? "" }
              : { name: "Гость", email: "", avatar: "" }
          }
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
