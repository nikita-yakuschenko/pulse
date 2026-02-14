import { WarehouseTransfersView } from "@/components/warehouse-transfers-view"

export default function WarehouseTransfersPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Движение материалов</h1>
      </div>
      <WarehouseTransfersView />
    </div>
  )
}
