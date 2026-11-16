import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getAuthenticatedLocale } from "@eleva/auth/server"
import { getServerThemePreference } from "@eleva/dashboard/server-theme"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"
import { SettingsForm } from "../_components/settings-form"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  await requireMemberSpace()
  const [t, api, preferredLocale, initialTheme] = await Promise.all([
    getTranslations("settings"),
    getAuthedApiClient(),
    getAuthenticatedLocale(),
    getServerThemePreference(),
  ])
  const profile = await api.me.get()
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsForm
        profile={profile}
        apiBaseUrl={apiBaseUrl}
        preferredLocale={preferredLocale}
        initialTheme={initialTheme}
      />
    </div>
  )
}
