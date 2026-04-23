import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AppShell } from "@/components/app-shell"

export default async function PatientDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("appointments:view_own")) {
    redirect("/")
  }
  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">
          {t("dashboard.patient.welcome", {
            name: session.user.displayName ?? session.user.email,
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.patient.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}
