import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getSession, getAuthenticatedLocale } from "@eleva/auth/server"
import { SettingsWidgets } from "./settings-widgets"

export default async function SettingsPage() {
  const t = await getTranslations()
  const [session, preferredLocale] = await Promise.all([
    getSession(),
    getAuthenticatedLocale(),
  ])
  const avatarUrl = session?.user.avatarUrl ?? null
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.pageDescription")}
      />
      <SettingsWidgets
        avatarUrl={avatarUrl}
        displayName={session?.user.displayName ?? session?.user.email ?? ""}
        email={session?.user.email ?? ""}
        apiBaseUrl={apiBaseUrl}
        preferredLocale={preferredLocale}
      />
    </>
  )
}
