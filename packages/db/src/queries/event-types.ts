import { and, eq, isNull, asc } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import {
  eventTypes,
  type NewEventType,
  type EventType,
  type LocalizedText,
} from "../schema/main/index"

export async function listExpertEventTypes(
  orgId: string,
  expertProfileId: string
): Promise<EventType[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.expertProfileId, expertProfileId),
          isNull(eventTypes.deletedAt)
        )
      )
      .orderBy(asc(eventTypes.position), asc(eventTypes.createdAt))
  })
}

export async function getEventType(
  orgId: string,
  eventTypeId: string,
  expertProfileId: string
): Promise<EventType | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.expertProfileId, expertProfileId),
          isNull(eventTypes.deletedAt)
        )
      )
      .limit(1)
    return row
  })
}

export async function createEventType(
  orgId: string,
  data: Omit<NewEventType, "id" | "createdAt" | "updatedAt" | "deletedAt">
): Promise<EventType> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .insert(eventTypes)
      .values({ ...data, orgId })
      .returning()
    return row!
  })
}

export async function updateEventType(
  orgId: string,
  eventTypeId: string,
  data: Partial<
    Pick<
      EventType,
      | "slug"
      | "title"
      | "description"
      | "durationMinutes"
      | "priceAmount"
      | "currency"
      | "languages"
      | "sessionMode"
      | "bookingWindowDays"
      | "minimumNoticeMinutes"
      | "bufferBeforeMinutes"
      | "bufferAfterMinutes"
      | "cancellationWindowHours"
      | "rescheduleWindowHours"
      | "requiresApproval"
      | "worldwideMode"
      | "active"
      | "published"
      | "position"
      | "scheduleId"
    >
  >,
  expertProfileId: string
): Promise<EventType | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .update(eventTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.expertProfileId, expertProfileId),
          isNull(eventTypes.deletedAt)
        )
      )
      .returning()
    return row
  })
}

export async function deleteEventType(
  orgId: string,
  eventTypeId: string,
  expertProfileId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    const rows = await tx
      .update(eventTypes)
      .set({ deletedAt: new Date(), active: false, published: false })
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.expertProfileId, expertProfileId),
          isNull(eventTypes.deletedAt)
        )
      )
      .returning({ id: eventTypes.id })
    if (rows.length === 0) {
      throw new Error(`Event type ${eventTypeId} not found or already deleted`)
    }
  })
}

/**
 * Public query for the booking funnel — resolves an event type by slug
 * for a given expert. Uses platform admin context (no RLS) with
 * explicit active+published filter.
 */
export async function findPublicEventType(
  expertProfileId: string,
  slug: string
): Promise<
  | Pick<
      EventType,
      | "id"
      | "slug"
      | "title"
      | "description"
      | "durationMinutes"
      | "priceAmount"
      | "currency"
      | "languages"
      | "sessionMode"
      | "bookingWindowDays"
      | "minimumNoticeMinutes"
      | "bufferBeforeMinutes"
      | "bufferAfterMinutes"
      | "worldwideMode"
    >
  | undefined
> {
  return withPlatformAdminContext(async (tx: Tx) => {
    const [row] = await tx
      .select({
        id: eventTypes.id,
        slug: eventTypes.slug,
        title: eventTypes.title,
        description: eventTypes.description,
        durationMinutes: eventTypes.durationMinutes,
        priceAmount: eventTypes.priceAmount,
        currency: eventTypes.currency,
        languages: eventTypes.languages,
        sessionMode: eventTypes.sessionMode,
        bookingWindowDays: eventTypes.bookingWindowDays,
        minimumNoticeMinutes: eventTypes.minimumNoticeMinutes,
        bufferBeforeMinutes: eventTypes.bufferBeforeMinutes,
        bufferAfterMinutes: eventTypes.bufferAfterMinutes,
        worldwideMode: eventTypes.worldwideMode,
      })
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.expertProfileId, expertProfileId),
          eq(eventTypes.slug, slug.toLowerCase()),
          eq(eventTypes.active, true),
          eq(eventTypes.published, true),
          isNull(eventTypes.deletedAt)
        )
      )
      .limit(1)
    return row
  })
}

/**
 * List published event types for an expert's public profile.
 */
export async function listPublicEventTypes(
  expertProfileId: string
): Promise<
  Pick<
    EventType,
    | "id"
    | "slug"
    | "title"
    | "description"
    | "durationMinutes"
    | "priceAmount"
    | "currency"
    | "languages"
    | "sessionMode"
  >[]
> {
  return withPlatformAdminContext(async (tx: Tx) => {
    return tx
      .select({
        id: eventTypes.id,
        slug: eventTypes.slug,
        title: eventTypes.title,
        description: eventTypes.description,
        durationMinutes: eventTypes.durationMinutes,
        priceAmount: eventTypes.priceAmount,
        currency: eventTypes.currency,
        languages: eventTypes.languages,
        sessionMode: eventTypes.sessionMode,
      })
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.expertProfileId, expertProfileId),
          eq(eventTypes.active, true),
          eq(eventTypes.published, true),
          isNull(eventTypes.deletedAt)
        )
      )
      .orderBy(asc(eventTypes.position))
  })
}
