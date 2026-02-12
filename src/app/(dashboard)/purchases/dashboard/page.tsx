import { KpiChart, KpiHeroCard, KpiMetricCard } from "@/components/dashboard"
import {
  MOCK_KPI_METRICS,
  MOCK_KPI_SUMMARY,
  MOCK_KPI_TREND,
} from "@/lib/kpi"

export default function PurchasesDashboardPage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-5 md:px-6 md:py-5">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
        Панель управления
      </h1>

      {/* 1 строка: Эффективность за период + Динамика общего KPI */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KpiHeroCard summary={MOCK_KPI_SUMMARY} />
        <KpiChart data={MOCK_KPI_TREND} />
      </section>

      {/* Сетка из 7 KPI */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Показатели эффективности
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MOCK_KPI_METRICS.map((metric) => (
            <KpiMetricCard
              key={metric.code}
              metric={metric}
              showPercentAsPrimary={
                metric.code === "budget" ||
                metric.code === "urgent" ||
                metric.code === "leadtime"
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
