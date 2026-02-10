import { LoginForm } from "@/components/login-form"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const params = await searchParams
  const sessionExpired = params.reason === "session_expired"
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10" suppressHydrationWarning>
      <div className="w-full max-w-sm md:max-w-4xl" suppressHydrationWarning>
        {sessionExpired && (
          <p className="text-muted-foreground mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm dark:border-amber-800 dark:bg-amber-950/50">
            Сессия истекла (максимум 3 месяца). Войдите снова и введите код 2FA при необходимости.
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
