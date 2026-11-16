import { getTranslations } from "next-intl/server"
import { getAuthenticatedLocale } from "@eleva/auth/server"
import { getServerThemePreference } from "@eleva/dashboard/server-theme"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getPersonalApiClient } from "@/lib/personal-api"
import { AppearanceCard } from "./appearance-card"
import { DetailsCard } from "./details-card"
import { RegionCard } from "./region-card"

export const dynamic = "force-dynamic"

/** Profile: everything about the person, shared by all their workspaces. */
export default async function ProfilePage() {
  const [t, api, preferredLocale, initialTheme] = await Promise.all([
    getTranslations("profile"),
    getPersonalApiClient(),
    getAuthenticatedLocale(),
    getServerThemePreference(),
  ])
  const profile = await api.me.get()
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <DetailsCard
        name={profile.name}
        email={profile.email}
        avatarUrl={profile.avatarUrl}
        apiBaseUrl={apiBaseUrl}
      />
      <RegionCard
        locale={preferredLocale ?? profile.locale ?? "en"}
        timezone={profile.timezone ?? "Europe/Lisbon"}
      />
      <AppearanceCard initialTheme={initialTheme} />
    </div>
  )
}
