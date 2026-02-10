import { createClient } from "@/lib/supabase/server"
import { DashboardGate } from "@/components/dashboard-gate"

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userProp = user
    ? {
        name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Пользователь",
        email: user.email ?? "",
        avatar: (user.user_metadata?.avatar_url as string) || "",
      }
    : null

  return (
    <DashboardGate userProp={userProp}>
      {children}
    </DashboardGate>
  )
}
