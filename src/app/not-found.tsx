import { NotFound as NotFoundComponent } from "@/components/ui/not-found"

/**
 * Глобальная 404 страница Next.js
 * Отображается автоматически при переходе на несуществующий маршрут
 */
export default function NotFoundPage() {
  return (
    <NotFoundComponent
      title="404"
      description="Страница, которую вы ищете, могла быть перемещена или не существует."
      homeUrl="/"
      homeLabel="На главную"
      exploreUrl="/purchases/dashboard"
      exploreLabel="Панель управления"
      showExplore={true}
    />
  )
}
