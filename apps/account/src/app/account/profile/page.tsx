import { getTranslations } from "next-intl/server"
import {
  getWidgetTokenFromSession,
  getSession,
  getAuthenticatedWorkOSLocale,
} from "@eleva/auth/server"
import { SettingsWidgets } from "./settings-widgets"
import { getCurrentAvatarUrl } from "./actions"

export default async function ProfilePage() {
  const t = await getTranslations()
  const [authToken, session, avatarUrl, preferredLocale] = await Promise.all([
    getWidgetTokenFromSession(),
    getSession(),
    getCurrentAvatarUrl(),
    getAuthenticatedWorkOSLocale(),
  ])

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <>
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-medium">{t("settings.title")}</h1>
      </header>
      <SettingsWidgets
        authToken={authToken}
        avatarUrl={avatarUrl}
        displayName={session?.user.displayName ?? session?.user.email ?? ""}
        apiBaseUrl={apiBaseUrl}
        preferredLocale={preferredLocale}
      />
    </>
  )
}
