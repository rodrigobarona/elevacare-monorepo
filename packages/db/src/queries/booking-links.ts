import { and, desc, eq, isNull } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  bookingLinks,
  eventTypes,
  type BookingLink,
  type NewBookingLink,
} from "../schema/main/index"

export type BookingLinkStatus = "active" | "used" | "expired" | "revoked"

export function deriveBookingLinkStatus(
  link: {
    revokedAt: Date | null
    expiresAt: Date
    useCount: number
    maxUses: number
  },
  now: Date = new Date()
): BookingLinkStatus {
  if (link.revokedAt != null) return "revoked"
  if (link.expiresAt.getTime() <= now.getTime()) return "expired"
  if (link.useCount >= link.maxUses) return "used"
  return "active"
}

/** Serialize a booking link row for API / RSC list payloads. */
export function toBookingLinkListItem(link: BookingLink): {
  id: string
  eventTypeId: string
  eventTypeModeId: string | null
  scheduleId: string | null
  recipientEmail: string | null
  priceCents: number | null
  note: string | null
  expiresAt: string
  maxUses: number
  useCount: number
  status: BookingLinkStatus
  createdAt: string
  revokedAt: string | null
} {
  return {
    id: link.id,
    eventTypeId: link.eventTypeId,
    eventTypeModeId: link.eventTypeModeId,
    scheduleId: link.scheduleId,
    recipientEmail: link.recipientEmail,
    priceCents: link.priceCents,
    note: link.note,
    expiresAt: link.expiresAt.toISOString(),
    maxUses: link.maxUses,
    useCount: link.useCount,
    status: deriveBookingLinkStatus(link),
    createdAt: link.createdAt.toISOString(),
    revokedAt: link.revokedAt?.toISOString() ?? null,
  }
}

export async function listBookingLinksForEventType(
  orgId: string,
  eventTypeId: string,
  expertProfileId: string
): Promise<BookingLink[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [owned] = await tx
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.orgId, orgId),
          eq(eventTypes.expertProfileId, expertProfileId)
        )
      )
      .limit(1)
    if (!owned) return []

    return tx
      .select()
      .from(bookingLinks)
      .where(
        and(
          eq(bookingLinks.orgId, orgId),
          eq(bookingLinks.eventTypeId, eventTypeId)
        )
      )
      .orderBy(desc(bookingLinks.createdAt))
  })
}

export async function createBookingLink(
  orgId: string,
  data: Omit<NewBookingLink, "id" | "createdAt" | "useCount" | "revokedAt">,
  txOpt?: Tx
): Promise<BookingLink> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .insert(bookingLinks)
      .values({
        ...data,
        orgId,
        useCount: 0,
        revokedAt: null,
      })
      .returning()
    return row!
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function getBookingLinkForExpert(
  orgId: string,
  linkId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<BookingLink | undefined> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .select({
        link: bookingLinks,
      })
      .from(bookingLinks)
      .innerJoin(
        eventTypes,
        and(
          eq(eventTypes.id, bookingLinks.eventTypeId),
          eq(eventTypes.orgId, bookingLinks.orgId),
          eq(eventTypes.expertProfileId, expertProfileId)
        )
      )
      .where(and(eq(bookingLinks.id, linkId), eq(bookingLinks.orgId, orgId)))
      .limit(1)
    return row?.link
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function revokeBookingLink(
  orgId: string,
  linkId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<{ link: BookingLink; changed: boolean } | undefined> {
  const run = async (tx: Tx) => {
    const existing = await getBookingLinkForExpert(
      orgId,
      linkId,
      expertProfileId,
      tx
    )
    if (!existing) return undefined

    const [row] = await tx
      .update(bookingLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(bookingLinks.id, linkId),
          eq(bookingLinks.orgId, orgId),
          isNull(bookingLinks.revokedAt)
        )
      )
      .returning()

    if (row) return { link: row, changed: true }
    return { link: existing, changed: false }
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}
