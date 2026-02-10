import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function CheckEmailPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-xl font-semibold">Проверьте почту</h1>
            <p className="text-muted-foreground text-sm">
              Мы отправили ссылку для подтверждения на указанный при регистрации email.
              Перейдите по ссылке из письма, чтобы завершить создание аккаунта.
            </p>
            <p className="text-muted-foreground text-sm">
              Не пришло письмо? Проверьте папку «Спам» или попробуйте войти снова и запросить повторную отправку.
            </p>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/sign-in">Войти</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
