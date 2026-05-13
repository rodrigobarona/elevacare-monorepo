import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession, getWidgetTokenFromSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, listCalendarIntegrations } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { CalendarManager } from "./calendar-manager"

export const dynamic = "force-dynamic"

const SLUG_LABEL: Record<string, string> = {
  "google-calendar": "Google Calendar",
  "microsoft-calendar": "Microsoft Calendar",
}

export default async function CalendarsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

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
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/expert/integrations" className="hover:underline">
            {t("backToIntegrations")}
          </Link>
          <span>/</span>
          <span>{t("title")}</span>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </header>

        <CalendarManager
          integrations={integrations}
          pipesWidgetToken={widgetToken}
        />
      </div>
    </AppShell>
  )
}
