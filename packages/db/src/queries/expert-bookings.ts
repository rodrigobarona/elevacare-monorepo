import { and, asc, eq, gt, lt, notInArray } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import {
  bookings,
  eventTypeModes,
  eventTypes,
  expertPracticeLocations,
  type SessionMode,
} from "../schema/main/index"
import type { LocalizedText } from "../schema/main/shared"

const EXCLUDED_STATUSES = ["cancelled", "no_show", "refunded"] as const

export type ExpertBookingListItem = {
  id: string
  status: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: SessionMode
  memberFirstName: string | null
  eventTypeTitle: LocalizedText
  eventTypeSlug: string
  modeLabel: LocalizedText | null
  locationName: string | null
  locationCity: string | null
  locationCountry: string | null
  locationAddress: string | null
}

function firstNameFromGuest(guestName: string | null): string | null {
  if (!guestName) return null
  const trimmed = guestName.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

async function selectExpertBookingsInRange(
  tx: Tx,
  expertProfileId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ExpertBookingListItem[]> {
  const rows = await tx
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      timezone: bookings.timezone,
      sessionMode: bookings.sessionMode,
      guestName: bookings.guestName,
      eventTypeTitle: eventTypes.title,
      eventTypeSlug: eventTypes.slug,
      modeLabel: eventTypeModes.label,
      locationName: expertPracticeLocations.name,
      locationCity: expertPracticeLocations.city,
      locationCountry: expertPracticeLocations.country,
      locationAddress: expertPracticeLocations.address,
    })
    .from(bookings)
    .innerJoin(
      eventTypes,
      and(
        eq(eventTypes.id, bookings.eventTypeId),
        eq(eventTypes.orgId, bookings.orgId)
      )
    )
    .leftJoin(
      eventTypeModes,
      and(
        eq(eventTypeModes.id, bookings.eventTypeModeId),
        eq(eventTypeModes.orgId, bookings.orgId)
      )
    )
    .leftJoin(
      expertPracticeLocations,
      and(
        eq(expertPracticeLocations.id, eventTypeModes.locationId),
        eq(expertPracticeLocations.orgId, bookings.orgId)
      )
    )
    .where(
      and(
        eq(bookings.expertProfileId, expertProfileId),
        notInArray(bookings.status, [...EXCLUDED_STATUSES]),
        lt(bookings.startsAt, rangeEnd),
        gt(bookings.endsAt, rangeStart)
      )
    )
    .orderBy(asc(bookings.startsAt), asc(bookings.id))

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    sessionMode: row.sessionMode,
    memberFirstName: firstNameFromGuest(row.guestName),
    eventTypeTitle: row.eventTypeTitle,
    eventTypeSlug: row.eventTypeSlug,
    modeLabel: row.modeLabel,
    locationName: row.locationName,
    locationCity: row.locationCity,
    locationCountry: row.locationCountry,
    locationAddress: row.locationAddress,
  }))
}

/** Expert agenda: tenant-scoped list for the calendar week/month view. */
export async function listExpertBookings(
  orgId: string,
  expertProfileId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ExpertBookingListItem[]> {
  return withOrgContext(orgId, async (tx: Tx) =>
    selectExpertBookingsInRange(tx, expertProfileId, rangeStart, rangeEnd)
  )
}

/**
 * Public ICS feed window (±90d / +365d). Platform-admin because the feed
 * token is the only auth signal — no org session.
 */
export async function listExpertBookingsForFeed(
  expertProfileId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ExpertBookingListItem[]> {
  return withPlatformAdminContext(async (tx: Tx) =>
    selectExpertBookingsInRange(tx, expertProfileId, rangeStart, rangeEnd)
  )
}
