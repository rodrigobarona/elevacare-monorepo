import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { getSession, getAuthenticatedWorkOSLocale } from "@eleva/auth/server"
import { SettingsWidgets } from "./settings-widgets"

export default async function SettingsPage() {
  const t = await getTranslations()
  const [session, preferredLocale] = await Promise.all([
    getSession(),
    getAuthenticatedWorkOSLocale(),
  ])
  const avatarUrl = session?.user.avatarUrl ?? null
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <>
      <AccountPageHeader
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
