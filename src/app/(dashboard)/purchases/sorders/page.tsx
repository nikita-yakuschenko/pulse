import { SupplierOrdersTable } from "@/app/(dashboard)/purchases/supplier-orders-table"

export default function SordersPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Заказы поставщикам</h1>
        <div className="mt-3">
          <SupplierOrdersTable />
        </div>
      </div>
    </div>
  )
}
