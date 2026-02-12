"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { IconBox } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import { formatMaterialQty, formatUnit } from "@/lib/utils"
import type { MaterialTreeNode } from "@/types/1c"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

/** SVG коробка с анимированными створками */
function AnimatedBox({ cycle }: { cycle: number }) {
  return (
    <motion.svg
      key={cycle}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      className="text-primary"
      initial={{ x: 100, opacity: 0 }}
      animate={{
        x: [100, 0, 0, 0, -100],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration: 2.5,
        times: [0, 0.2, 0.6, 0.8, 1],
        ease: "easeInOut",
      }}
    >
      {/* Основа коробки */}
      <motion.rect
        x="12"
        y="12"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Левая створка */}
      <motion.g
        style={{ transformOrigin: "12px 24px" }}
        animate={{
          rotateY: [0, -85, -85, 0],
        }}
        transition={{
          duration: 2.5,
          times: [0, 0.4, 0.6, 0.8],
          ease: "easeInOut",
        }}
      >
        <motion.path
          d="M 12 12 L 12 36"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          animate={{
            opacity: [1, 0.2, 0.2, 1],
          }}
          transition={{
            duration: 2.5,
            times: [0, 0.4, 0.6, 0.8],
          }}
        />
      </motion.g>

      {/* Правая створка */}
      <motion.g
        style={{ transformOrigin: "36px 24px" }}
        animate={{
          rotateY: [0, 85, 85, 0],
        }}
        transition={{
          duration: 2.5,
          times: [0, 0.5, 0.7, 0.9],
          ease: "easeInOut",
        }}
      >
        <motion.path
          d="M 36 12 L 36 36"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          animate={{
            opacity: [1, 0.2, 0.2, 1],
          }}
          transition={{
            duration: 2.5,
            times: [0, 0.5, 0.7, 0.9],
          }}
        />
      </motion.g>

      {/* Верхняя линия */}
      <motion.line
        x1="12"
        y1="12"
        x2="36"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Нижняя линия */}
      <motion.line
        x1="12"
        y1="36"
        x2="36"
        y2="36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Диагонали для 3D эффекта */}
      <motion.g
        animate={{
          opacity: [0.6, 0.6, 0.6, 0.6],
        }}
      >
        <line x1="12" y1="12" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="12" x2="42" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="36" x2="42" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="18" y1="6" x2="42" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="6" x2="42" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
    </motion.svg>
  )
}

/** Компонент анимированной загрузки */
function LoadingAnimation() {
  const messages = [
    "Проверяю поступления",
    "Проверяю списания",
    "Проверяю заказы поставщикам",
    "Пью кофе",
  ]

  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [animationCycle, setAnimationCycle] = React.useState(0)

  React.useEffect(() => {
    const cycleInterval = setInterval(() => {
      setAnimationCycle((prev) => prev + 1)
      setCurrentIndex((prev) => (prev + 1) % messages.length)
    }, 2500)

    return () => clearInterval(cycleInterval)
  }, [messages.length])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center gap-4">
            {/* Анимированная коробка */}
            <div className="relative h-12 w-12">
              <AnimatePresence mode="wait">
                <AnimatedBox key={animationCycle} cycle={animationCycle} />
              </AnimatePresence>
            </div>

            {/* Анимированный текст */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-muted-foreground text-center"
                >
                  {messages[currentIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Рекурсивный поиск материала по коду в дереве */
function findMaterialByCode(
  nodes: MaterialTreeNode[] | null | undefined,
  code: string
): MaterialTreeNode | undefined {
  if (!nodes?.length) return undefined
  for (const node of nodes) {
    if (!node.ЭтоГруппа && node.Код === code) {
      return node
    }
    if (node.ЭтоГруппа && node.Дети) {
      const found = findMaterialByCode(node.Дети, code)
      if (found) return found
    }
  }
  return undefined
}

export default function MaterialMobileViewPage() {
  const params = useParams()
  const code = params.code as string

  const [material, setMaterial] = React.useState<MaterialTreeNode | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!code) {
      setError("Код материала не указан")
      setLoading(false)
      return
    }

    // Загружаем полное дерево остатков по ВСЕМ складам
    fetch("/api/1c/warehouse/balances-full")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        const tree = Array.isArray(json.data) ? json.data : []
        const found = findMaterialByCode(tree, code)
        if (!found) {
          setError("Материал не найден")
        } else {
          setMaterial(found)
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Ошибка загрузки")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [code])

  if (loading) {
    return <LoadingAnimation />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-destructive">
              <IconBox className="h-8 w-8" />
              <p className="text-center">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!material) {
    return null
  }

  const totalQty = (material.Остатки ?? []).reduce((sum, b) => sum + b.Количество, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 to-muted/10 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <IconBox className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg leading-tight mb-2">
                {material.Наименование}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Код:</span>
                <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                  {material.Код}
                </code>
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="space-y-3">
            {/* Общий остаток */}
            <div className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg">
              <span className="text-sm font-medium">Всего в наличии:</span>
              <span className="text-base font-semibold tabular-nums">
                {formatMaterialQty(totalQty)} {formatUnit(material.ЕдиницаИзмерения)}
              </span>
            </div>

            {/* Остатки по складам */}
            {material.Остатки && material.Остатки.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
                  По складам
                </p>
                <div className="space-y-1.5">
                  {material.Остатки.map((balance, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2.5 px-3 bg-card border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm text-foreground/80 flex-1 min-w-0 truncate">
                        {balance.Склад || "Неизвестный склад"}
                      </span>
                      <span className="text-sm font-medium tabular-nums shrink-0 ml-3">
                        {formatMaterialQty(balance.Количество)} {formatUnit(material.ЕдиницаИзмерения)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Остатки отсутствуют
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
