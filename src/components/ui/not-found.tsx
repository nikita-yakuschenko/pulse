"use client"

import { HomeIcon, CompassIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

interface NotFoundProps {
  /** Текст заголовка */
  title?: string
  /** Описание ошибки */
  description?: string
  /** URL для кнопки "На главную" */
  homeUrl?: string
  /** Текст кнопки "На главную" */
  homeLabel?: string
  /** URL для кнопки "Обзор" */
  exploreUrl?: string
  /** Текст кнопки "Обзор" */
  exploreLabel?: string
  /** Показывать ли кнопку "Обзор" */
  showExplore?: boolean
}

/**
 * Компонент 404 страницы
 * Отображает сообщение о том, что страница не найдена
 */
export function NotFound({
  title = "404",
  description = "Страница, которую вы ищете, могла быть перемещена или не существует.",
  homeUrl = "/",
  homeLabel = "На главную",
  exploreUrl = "/purchases/dashboard",
  exploreLabel = "Панель управления",
  showExplore = true,
}: NotFoundProps = {}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyTitle className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-extrabold text-transparent text-9xl tracking-tighter">
            {title}
          </EmptyTitle>
          <EmptyDescription className="mt-6 text-base text-foreground/70">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={homeUrl}>
                <HomeIcon className="size-4" />
                {homeLabel}
              </Link>
            </Button>

            {showExplore && (
              <Button asChild variant="outline">
                <Link href={exploreUrl}>
                  <CompassIcon className="size-4" />
                  {exploreLabel}
                </Link>
              </Button>
            )}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
