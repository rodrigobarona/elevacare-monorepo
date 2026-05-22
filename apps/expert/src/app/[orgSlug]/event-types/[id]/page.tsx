import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { getEventType } from "@eleva/db"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { EventTypeForm } from "../event-type-form"
import type { EventTypeFormData } from "../actions"

export const dynamic = "force-dynamic"

type LocalizedText = { en: string; pt?: string; es?: string }

export default async function EditEventTypePage(props: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await props.params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const base = expertWorkspaceBase(session)

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
    <div className="mx-auto max-w-2xl space-y-6">
      <AccountPageHeader
        title={t("editTitle")}
        description={t("editDescription")}
      />
      <EventTypeForm
        mode="edit"
        eventTypeId={id}
        defaultValues={defaults}
        workspaceBase={base}
      />
    </div>
  )
}
