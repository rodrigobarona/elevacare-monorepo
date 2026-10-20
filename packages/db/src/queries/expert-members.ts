import { and, desc, eq, notInArray } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import { user } from "../schema/auth"
import { bookings, eventTypes } from "../schema/main/index"
import type { LocalizedText } from "../schema/main/shared"

const EXCLUDED_STATUSES = ["cancelled", "refunded"] as const
const MEMBER_BOOKINGS_LIMIT = 2000

export type ExpertMemberListItem = {
  /** Present when the member has an Eleva account; guests have none. */
  memberUserId: string | null
  name: string | null
  email: string | null
  sessionCount: number
  lastSessionAt: Date | null
  nextSessionAt: Date | null
}

export type ExpertMemberSession = {
  id: string
  status: string
  startsAt: Date
  endsAt: Date
  sessionMode: string
  eventTypeTitle: LocalizedText
}

export type ExpertMemberDetail = {
  memberUserId: string
  name: string | null
  email: string | null
  sessions: ExpertMemberSession[]
}

function memberKey(row: {
  memberUserId: string | null
  email: string | null
}): string | null {
  if (row.memberUserId) return `u:${row.memberUserId}`
  const email = row.email?.trim().toLowerCase()
  return email ? `g:${email}` : null
}

async function selectExpertBookingsWithMembers(
  tx: Tx,
  orgId: string,
  expertProfileId: string,
  memberUserId?: string
) {
  return tx
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      sessionMode: bookings.sessionMode,
      memberUserId: bookings.memberUserId,
      guestName: bookings.guestName,
      guestEmail: bookings.guestEmail,
      userName: user.name,
      userEmail: user.email,
      eventTypeTitle: eventTypes.title,
    })
    .from(bookings)
    .innerJoin(
      eventTypes,
      and(
        eq(eventTypes.id, bookings.eventTypeId),
        eq(eventTypes.orgId, bookings.orgId)
      )
    )
    .leftJoin(user, eq(user.id, bookings.memberUserId))
    .where(
      and(
        eq(bookings.orgId, orgId),
        eq(bookings.expertProfileId, expertProfileId),
        notInArray(bookings.status, [...EXCLUDED_STATUSES]),
        memberUserId ? eq(bookings.memberUserId, memberUserId) : undefined
      )
    )
    .orderBy(desc(bookings.startsAt), desc(bookings.id))
    .limit(MEMBER_BOOKINGS_LIMIT)
}

/**
 * Expert member list derived from their bookings, newest first.
 * Guests without an account are grouped by email.
 */
export async function listExpertMembers(
  orgId: string,
  expertProfileId: string,
  now: Date = new Date()
): Promise<ExpertMemberListItem[]> {
  const rows = await withOrgContext(orgId, (tx: Tx) =>
    selectExpertBookingsWithMembers(tx, orgId, expertProfileId)
  )

  const members = new Map<string, ExpertMemberListItem>()
  for (const row of rows) {
    const email = row.guestEmail ?? row.userEmail
    const key = memberKey({ memberUserId: row.memberUserId, email })
    if (!key) continue
    const existing = members.get(key)
    const isPast = row.startsAt.getTime() <= now.getTime()
    if (!existing) {
      members.set(key, {
        memberUserId: row.memberUserId,
        name: row.guestName ?? row.userName,
        email,
        sessionCount: 1,
        lastSessionAt: isPast ? row.startsAt : null,
        nextSessionAt: isPast ? null : row.startsAt,
      })
      continue
    }
    existing.sessionCount += 1
    if (isPast && !existing.lastSessionAt) existing.lastSessionAt = row.startsAt
    if (!isPast) existing.nextSessionAt = row.startsAt
  }
  return [...members.values()]
}

/** One member's sessions with this expert, newest first. */
export async function getExpertMember(
  orgId: string,
  expertProfileId: string,
  memberUserId: string
): Promise<ExpertMemberDetail | null> {
  const rows = await withOrgContext(orgId, (tx: Tx) =>
    selectExpertBookingsWithMembers(tx, orgId, expertProfileId, memberUserId)
  )
  const [latest] = rows
  if (!latest) return null
  return {
    memberUserId,
    name: latest.guestName ?? latest.userName,
    email: latest.guestEmail ?? latest.userEmail,
    sessions: rows.map((row) => ({
      id: row.id,
      status: row.status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      sessionMode: row.sessionMode,
      eventTypeTitle: row.eventTypeTitle,
    })),
  }
}
