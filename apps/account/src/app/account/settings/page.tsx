import { getLocale, getTranslations } from "next-intl/server"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { AccountPageHeader } from "@eleva/dashboard"
import {
  getWidgetTokenFromSession,
  getSession,
  getAuthenticatedWorkOSLocale,
} from "@eleva/auth/server"
import { SettingsWidgets } from "./settings-widgets"

export default async function SettingsPage() {
  const t = await getTranslations()
  const [locale, authToken, session, preferredLocale, workosAuth] =
    await Promise.all([
      getLocale(),
      getWidgetTokenFromSession(),
      getSession(),
      getAuthenticatedWorkOSLocale(),
      withAuth(),
    ])
  const workosSessionId = workosAuth.sessionId ?? ""
  const avatarUrl = session?.user.avatarUrl ?? null

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <>
      <AccountPageHeader
        title={t("settings.title")}
        description={t("settings.pageDescription")}
      />
      <SettingsWidgets
        locale={locale}
        authToken={authToken}
        workosSessionId={workosSessionId}
        avatarUrl={avatarUrl}
        displayName={session?.user.displayName ?? session?.user.email ?? ""}
        email={session?.user.email ?? ""}
        apiBaseUrl={apiBaseUrl}
        preferredLocale={preferredLocale}
      />
    </>
  )
}
