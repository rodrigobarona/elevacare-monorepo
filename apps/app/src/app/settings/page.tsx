import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AppShell } from "@/components/app-shell"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-medium">{t("settings.profile.title")}</h1>
      </header>
      <dl className="grid max-w-md grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">{t("settings.profile.email")}</dt>
        <dd>{session.user.email}</dd>
        <dt className="text-muted-foreground">
          {t("settings.profile.language")}
        </dt>
        <dd>\u2014</dd>
      </dl>
    </AppShell>
  )
}
