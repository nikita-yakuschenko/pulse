"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { KPI_LABELS, KPI_WEIGHTS, type KpiMetric } from "@/lib/kpi"

const chartConfig = {
  contribution: {
    label: "Вклад в KPI",
    color: "hsl(var(--chart-2))",
  },
  name: {
    label: "Показатель",
  },
} satisfies ChartConfig

interface KpiWeightsChartProps {
  metrics: KpiMetric[]
  className?: string
}

/** Горизонтальный барчарт: вклад каждого показателя (коэфф. × вес) в общий KPI */
export function KpiWeightsChart({ metrics, className }: KpiWeightsChartProps) {
  const weightMap = KPI_WEIGHTS as Record<string, number>
  const chartData = metrics.map((m) => ({
    name: KPI_LABELS[m.code].slice(0, 22) + (KPI_LABELS[m.code].length > 22 ? "…" : ""),
    fullName: KPI_LABELS[m.code],
    contribution: Math.round(m.coefficient * (weightMap[m.code] ?? 0) * 10000) / 10000,
    weight: weightMap[m.code] ?? 0,
    coefficient: m.coefficient,
  }))

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
      >
        <XAxis type="number" domain={[0, 0.35]} hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, _item, _index, payload) => {
                const weight =
                  payload?.weight != null ? (payload.weight * 100).toFixed(0) : ""
                return [`${Number(value).toFixed(4)}`, weight ? `Вклад (вес ${weight}%)` : "Вклад"]
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
          }
        />
        <Bar
          dataKey="contribution"
          fill="var(--color-contribution)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
