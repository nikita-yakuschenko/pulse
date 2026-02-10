import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Модуль.Пульс</h1>
      <p className="text-muted-foreground">
        Система управления закупками и KPI
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/dashboard">Войти в систему</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-in">Вход</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Регистрация</Link>
        </Button>
      </div>
    </div>
  );
}
