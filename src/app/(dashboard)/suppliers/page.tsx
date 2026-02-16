import { SuppliersView } from "@/components/suppliers-view"

export default function SuppliersPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Поставщики</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Избранные поставщики и справочник из 1С
        </p>
      </div>
      <SuppliersView />
    </div>
  )
}
