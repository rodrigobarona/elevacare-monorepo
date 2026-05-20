import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSession } from "@eleva/auth"
import { getWidgetTokenFromSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, listCalendarIntegrations } from "@eleva/db"
import { CalendarManager } from "./calendar-manager"

export const dynamic = "force-dynamic"

const SLUG_LABEL: Record<string, string> = {
  "google-calendar": "Google Calendar",
  "microsoft-calendar": "Microsoft Calendar",
}

export default async function CalendarsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSession()
  if (!session.capabilities.includes("events:manage")) redirect(`/${orgSlug}`)

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect(`/${orgSlug}/expert/onboarding`)

  const integrations = (
    await listCalendarIntegrations(profile.orgId, profile.id)
  ).map((i) => ({
    id: i.id,
    slug: i.slug,
    providerLabel: SLUG_LABEL[i.slug] ?? i.slug,
    accountIdentifier: i.accountIdentifier,
    status: i.status,
  }))

  let widgetToken: string | null = null
  try {
    widgetToken = await getWidgetTokenFromSession()
  } catch (err) {
    console.error("[calendars] Failed to get widget token:", err)
  }

  const t = await getTranslations("calendars")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${orgSlug}/expert/integrations`}
          className="hover:underline"
        >
          {t("backToIntegrations")}
        </Link>
        <span>/</span>
        <span>{t("title")}</span>
      </div>

      <AccountPageHeader title={t("title")} description={t("description")} />

      <CalendarManager
        integrations={integrations}
        pipesWidgetToken={widgetToken}
      />
    </div>
  )
}
