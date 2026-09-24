import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import {
  getEventType,
  listEventTypeModes,
  listPracticeLocations,
  listSchedules,
} from "@eleva/db"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { EventTypeForm } from "../event-type-form"
import {
  EventTypeModesPanel,
  type LocationOption,
  type ModeRow,
  type ScheduleOption,
} from "../event-type-modes-panel"
import type { EventTypeFormData } from "../actions"

export const dynamic = "force-dynamic"

type LocalizedText = { en: string; pt?: string; es?: string }

function locationLabel(row: {
  name: string
  city: string
  country: string
}): string {
  return `${row.name} · ${row.city}, ${row.country}`
}

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

  const [modes, schedules, locations] = await Promise.all([
    listEventTypeModes(profile.orgId, id, { includeInactive: true }),
    listSchedules(profile.orgId, profile.id),
    listPracticeLocations(profile.orgId, profile.id, {
      includeInactive: true,
    }),
  ])

  const t = await getTranslations("eventTypes")

  const defaults: Partial<EventTypeFormData> = {
    slug: eventType.slug,
    title: eventType.title as LocalizedText,
    description: (eventType.description as LocalizedText) ?? { en: "" },
    durationMinutes: eventType.durationMinutes,
    priceAmount: eventType.priceAmount,
    currency: "EUR",
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

  const modeRows: ModeRow[] = modes.map((m) => ({
    id: m.id,
    mode: m.mode,
    locationId: m.locationId,
    scheduleId: m.scheduleId,
    priceCents: m.priceCents,
    currency: m.currency,
    durationMinutes: m.durationMinutes,
    countryScopeType: m.countryScopeType,
    countryScopeCodes: m.countryScopeCodes as string[],
    languages: m.languages as string[],
    label: (m.label as LocalizedText | null) ?? null,
    active: m.active,
  }))

  const scheduleOptions: ScheduleOption[] = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    isDefault: s.isDefault,
  }))

  const locationOptions: LocationOption[] = locations.map((l) => ({
    id: l.id,
    label: locationLabel(l),
    country: l.country,
    active: l.active,
  }))

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
      <EventTypeModesPanel
        eventTypeId={id}
        modes={modeRows}
        schedules={scheduleOptions}
        locations={locationOptions}
        profileLanguages={profile.languages as string[]}
        serviceCountries={profile.serviceCountries as string[]}
        worldwideRemote={profile.worldwideRemote}
        eventTypeKind={eventType.kind}
      />
    </div>
  )
}
