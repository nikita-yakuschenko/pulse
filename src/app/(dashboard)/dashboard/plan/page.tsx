import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PlanPage() {
  return (
    <div className="container px-4 py-8">
      <h1 className="text-2xl font-bold">График производства</h1>
      <Tabs defaultValue="schedule" className="mt-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="schedule">График производства</TabsTrigger>
          <TabsTrigger value="planning">Планирование производства</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Раздел в разработке
          </div>
        </TabsContent>
        <TabsContent value="planning" className="mt-4">
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Раздел в разработке
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
