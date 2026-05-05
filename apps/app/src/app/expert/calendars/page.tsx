import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, listConnectedCalendars } from "@eleva/db"
import { WorkOS } from "@workos-inc/node"
import { AppShell } from "@/components/app-shell"
import { CalendarManager } from "./calendar-manager"

export const dynamic = "force-dynamic"

export default async function CalendarsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const calendars = (
    await listConnectedCalendars(profile.orgId, profile.id)
  ).map((c) => ({
    id: c.id,
    provider: c.provider,
    accountEmail: c.accountEmail,
    status: c.status,
  }))

  const workos = new WorkOS(process.env.WORKOS_API_KEY!)
  const widgetToken = await workos.widgets.getToken({
    userId: session.user.workosUserId,
    organizationId: session.workosOrgId,
  })

  const t = await getTranslations("calendars")

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </header>

        <CalendarManager calendars={calendars} pipesWidgetToken={widgetToken} />
      </div>
    </AppShell>
  )
}
