import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import { user } from "../schema/auth"
import { bookings, eventTypes } from "../schema/main/index"
import type { LocalizedText } from "../schema/main/shared"

/** Real bookings only: open holds and unpaid checkouts are not members yet. */
const MEMBER_STATUSES = [
  "awaiting_confirmation",
  "reserved",
  "confirmed",
  "rescheduled",
  "completed",
  "no_show",
] as const
const MEMBER_LIST_LIMIT = 2000
const MEMBER_SESSIONS_LIMIT = 500

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

async function selectExpertBookingsWithMembers(
  tx: Tx,
  orgId: string,
  expertProfileId: string,
  memberUserId: string
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
        inArray(bookings.status, [...MEMBER_STATUSES]),
        eq(bookings.memberUserId, memberUserId)
      )
    )
    .orderBy(desc(bookings.startsAt), desc(bookings.id))
    .limit(MEMBER_SESSIONS_LIMIT)
}

/**
 * Expert member list derived from their bookings, most recent booking
 * first. Guests without an account are grouped by normalised email.
 */
export async function listExpertMembers(
  orgId: string,
  expertProfileId: string,
  now: Date = new Date()
): Promise<ExpertMemberListItem[]> {
  const email = sql`coalesce(${bookings.guestEmail}, ${user.email})`
  const memberKey = sql<string>`coalesce('u:' || ${bookings.memberUserId}::text, 'g:' || lower(trim(${email})))`
  const latest = sql`${bookings.startsAt} desc, ${bookings.id} desc`
  const rows = await withOrgContext(orgId, (tx: Tx) =>
    tx
      .select({
        memberUserId: sql<
          string | null
        >`(array_agg(${bookings.memberUserId}::text order by ${latest}))[1]`,
        name: sql<
          string | null
        >`(array_agg(coalesce(${bookings.guestName}, ${user.name}) order by ${latest}))[1]`,
        email: sql<string | null>`(array_agg(${email} order by ${latest}))[1]`,
        sessionCount: sql<number>`count(*)::int`,
        lastSessionAt: sql<
          string | null
        >`max(${bookings.startsAt}) filter (where ${bookings.startsAt} <= ${now})`,
        nextSessionAt: sql<
          string | null
        >`min(${bookings.startsAt}) filter (where ${bookings.startsAt} > ${now})`,
      })
      .from(bookings)
      .leftJoin(user, eq(user.id, bookings.memberUserId))
      .where(
        and(
          eq(bookings.orgId, orgId),
          eq(bookings.expertProfileId, expertProfileId),
          inArray(bookings.status, [...MEMBER_STATUSES]),
          sql`${memberKey} is not null`
        )
      )
      .groupBy(memberKey)
      .orderBy(desc(sql`max(${bookings.startsAt})`))
      .limit(MEMBER_LIST_LIMIT)
  )
  return rows.map((row) => ({
    memberUserId: row.memberUserId,
    name: row.name,
    email: row.email,
    sessionCount: Number(row.sessionCount),
    lastSessionAt: row.lastSessionAt ? new Date(row.lastSessionAt) : null,
    nextSessionAt: row.nextSessionAt ? new Date(row.nextSessionAt) : null,
  }))
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
