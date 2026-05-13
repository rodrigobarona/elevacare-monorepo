import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AppShell } from "@/components/app-shell"

export default async function OrgSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")

  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-medium">{t("settings.org.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.org.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}
