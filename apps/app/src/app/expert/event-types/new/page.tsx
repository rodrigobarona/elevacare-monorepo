import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { EventTypeForm } from "../event-type-form"

export const dynamic = "force-dynamic"

export default async function NewEventTypePage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const t = await getTranslations("eventTypes")

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("createTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("createDescription")}
          </p>
        </header>
        <EventTypeForm mode="create" />
      </div>
    </AppShell>
  )
}
