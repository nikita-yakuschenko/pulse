"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { KpiSummary } from "@/lib/kpi"
import { cn } from "@/lib/utils"

interface KpiHeroCardProps {
  summary: KpiSummary
  className?: string
}

/** Главный виджет: общий коэффициент KPI и мотивация */
export function KpiHeroCard({ summary, className }: KpiHeroCardProps) {
  const pct = Math.round(summary.totalCoefficient * 100)
  const status =
    summary.totalCoefficient >= 0.9
      ? "отлично"
      : summary.totalCoefficient >= 0.7
        ? "хорошо"
        : "требует внимания"

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 py-4 gap-4",
        className
      )}
    >
      <CardHeader className="px-4 py-0 pb-2 md:px-6">
        <CardDescription className="text-xs">Эффективность за период</CardDescription>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <span className="tabular-nums">{summary.totalCoefficient.toFixed(4)}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {pct}% от максимума
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 md:px-6">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Общий коэффициент KPI</span>
            <span className="font-medium capitalize text-foreground">{status}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">База мотивации</p>
            <p className="text-base font-semibold tabular-nums">
              {summary.motivationBase.toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Мотивация за {summary.periodLabel}</p>
            <p className="text-base font-semibold tabular-nums text-primary">
              {summary.motivationAmount.toLocaleString("ru-RU")} ₽
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
