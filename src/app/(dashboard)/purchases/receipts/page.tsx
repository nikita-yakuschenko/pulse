import { ReceiptsTable } from "@/app/(dashboard)/purchases/receipts-table"

export default function ReceiptsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Поступление товаров и услуг</h1>
        <div className="mt-3">
          <ReceiptsTable />
        </div>
      </div>
    </div>
  )
}
