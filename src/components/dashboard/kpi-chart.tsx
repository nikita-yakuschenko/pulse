"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { KpiTrendPoint } from "@/lib/kpi"

// Оранжевый оттенок с градиентом (приятный акцент)
const KPI_CHART_ORANGE = "hsl(24, 95%, 55%)"
const KPI_CHART_ORANGE_LIGHT = "hsl(24, 90%, 92%)"

const chartConfig = {
  value: {
    label: "KPI общ",
    color: KPI_CHART_ORANGE,
  },
  month: {
    label: "Месяц",
  },
} satisfies ChartConfig

interface KpiChartProps {
  data: KpiTrendPoint[]
  className?: string
}

/** График динамики общего коэффициента KPI по месяцам (Area Chart) */
export function KpiChart({ data, className }: KpiChartProps) {
  const chartData = data.map((d) => ({
    month: d.month,
    value: Math.round(d.value * 100) / 100,
    fullLabel: d.label,
  }))

  const values = chartData.map((d) => d.value)
  const dataMin = values.length ? Math.min(...values) : 0
  const dataMax = values.length ? Math.max(...values) : 1
  const range = dataMax - dataMin || 0.2
  const padding = Math.max(range * 0.08, 0.02)
  const yMin = Math.max(0, dataMin - padding)
  // Верхняя граница: минимум 1.0 (100%), чтобы референсная линия всегда была видна
  const yMax = Math.max(1.0, dataMax + padding)
  const yDomain: [number, number] = [yMin, yMax]
  
  // Явные метки оси Y с шагом 10%
  const yTicks = [0.7, 0.8, 0.9, 1.0]

  const firstVal = chartData[0]?.value ?? 0
  const lastVal = chartData[chartData.length - 1]?.value ?? 0
  const trendPct =
    firstVal > 0
      ? (((lastVal - firstVal) / firstVal) * 100).toFixed(1)
      : "0"
  const trendUp = lastVal >= firstVal
  const periodLabel =
    chartData.length >= 2
      ? `${chartData[0]?.fullLabel ?? ""} — ${chartData[chartData.length - 1]?.fullLabel ?? ""}`
      : ""

  return (
    <Card className={className}>
      <CardHeader className="py-4 pb-2 px-4 md:px-6">
        <CardTitle className="text-base">Динамика общего KPI</CardTitle>
        <CardDescription className="text-xs">
          Общий коэффициент KPI за последние 6 месяцев
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 16, right: 48, top: 24, bottom: 8 }}
          >
            <defs>
              <linearGradient id="kpiAreaGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={KPI_CHART_ORANGE_LIGHT} stopOpacity={0.25} />
                <stop offset="50%" stopColor={KPI_CHART_ORANGE} stopOpacity={0.5} />
                <stop offset="100%" stopColor={KPI_CHART_ORANGE} stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <ReferenceLine
              y={1}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: "100%",
                position: "right",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="min-w-0 px-2 py-1.5"
                  formatter={(value) => Number(value).toFixed(2)}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? ""
                  }
                />
              }
            />
            <Area
              dataKey="value"
              type="natural"
              fill="url(#kpiAreaGradient)"
              stroke={KPI_CHART_ORANGE}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="py-2 px-4 md:px-6 flex w-full items-start gap-2 text-sm">
        <div className="grid gap-1">
          <div className="flex items-center gap-2 leading-none font-medium text-xs">
            {trendUp ? (
              <>
                Рост на {trendPct}% за период <TrendingUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>Снижение на {Math.abs(Number(trendPct))}% за период</>
            )}
          </div>
          {periodLabel && (
            <div className="text-muted-foreground text-xs leading-none">
              {periodLabel}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
