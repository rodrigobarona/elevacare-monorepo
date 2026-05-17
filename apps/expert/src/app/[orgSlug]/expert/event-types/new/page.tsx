import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { EventTypeForm } from "../event-type-form"

export const dynamic = "force-dynamic"

export default async function NewEventTypePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSession()
  if (!session.capabilities.includes("events:manage")) redirect(`/${orgSlug}`)

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect(`/${orgSlug}/expert/onboarding`)

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
