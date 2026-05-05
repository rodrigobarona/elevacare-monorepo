import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, getEventType } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { EventTypeForm } from "../event-type-form"
import type { EventTypeFormData } from "../actions"

export const dynamic = "force-dynamic"

type LocalizedText = { en: string; pt?: string; es?: string }

export default async function EditEventTypePage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const eventType = await getEventType(profile.orgId, id, profile.id)
  if (!eventType) notFound()

  const t = await getTranslations("eventTypes")

  const defaults: Partial<EventTypeFormData> = {
    slug: eventType.slug,
    title: eventType.title as LocalizedText,
    description: (eventType.description as LocalizedText) ?? { en: "" },
    durationMinutes: eventType.durationMinutes,
    priceAmount: eventType.priceAmount,
    currency: eventType.currency,
    languages: eventType.languages as string[],
    sessionMode: eventType.sessionMode,
    bookingWindowDays: eventType.bookingWindowDays,
    minimumNoticeMinutes: eventType.minimumNoticeMinutes,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    cancellationWindowHours: eventType.cancellationWindowHours,
    rescheduleWindowHours: eventType.rescheduleWindowHours,
    requiresApproval: eventType.requiresApproval,
    worldwideMode: eventType.worldwideMode,
  }

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("editTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("editDescription")}
          </p>
        </header>
        <EventTypeForm mode="edit" eventTypeId={id} defaultValues={defaults} />
      </div>
    </AppShell>
  )
}
