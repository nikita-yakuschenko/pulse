"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { KpiMetric } from "@/lib/kpi"
import { cn, getKpiBorderColor, getKpiProgressColor } from "@/lib/utils"

interface KpiMetricCardProps {
  metric: KpiMetric
  /** Показывать ли % как основное значение (для budget/leadtime/urgent — да) */
  showPercentAsPrimary?: boolean
  className?: string
}

/** Карточка одного KPI: название, значение, коэффициент, прогресс */
export function KpiMetricCard({
  metric,
  showPercentAsPrimary = false,
  className,
}: KpiMetricCardProps) {
  const progressValue = Math.round(metric.coefficient * 100)
  // Одна шкала для рамки и для цвета показателей: 0 → красный, 0.5 → жёлтый, 1 → зелёный
  const accentColor = getKpiBorderColor(metric.coefficient)

  return (
    <Card
      className={cn("flex flex-col py-3 gap-3 border-2", className)}
      style={{ borderColor: accentColor }}
    >
      <CardHeader className="px-4 py-0 pb-1 md:px-5">
        <CardDescription className="line-clamp-2 text-xs">{metric.label}</CardDescription>
        <CardTitle className="flex items-baseline gap-1.5 text-lg font-semibold tabular-nums">
          {showPercentAsPrimary ? (
            <>
              <span style={{ color: accentColor }}>{metric.percentValue.toFixed(1)}%</span>
              <span className="text-xs font-normal text-muted-foreground">
                коэфф. {metric.coefficient.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <span style={{ color: accentColor }}>{(metric.coefficient * 100).toFixed(1)}%</span>
              {metric.percentValue !== metric.coefficient * 100 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {metric.percentValue.toFixed(1)}%
                </span>
              )}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-auto space-y-2 px-4 md:px-5">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">0–1</span>
            <span className="font-medium" style={{ color: accentColor }}>
              {progressValue}%
            </span>
          </div>
          <Progress
            value={progressValue}
            className="h-1.5"
            indicatorStyle={{ backgroundColor: getKpiProgressColor(metric.coefficient) }}
          />
        </div>
        {metric.hint && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">{metric.hint}</p>
        )}
      </CardContent>
    </Card>
  )
}
