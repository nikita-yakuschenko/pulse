import { PaymentsTable } from "@/app/(dashboard)/purchases/payments-table"

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Заявки на оплату</h1>
        <div className="mt-6">
          <PaymentsTable />
        </div>
      </div>
    </div>
  )
}
