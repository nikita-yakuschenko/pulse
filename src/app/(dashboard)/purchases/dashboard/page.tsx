import { SectionCards } from "@/components/section-cards"

export default function PurchasesDashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      {/* Виджеты по заказам, оплатам и поступлениям будут добавлены позже */}
    </div>
  )
}
