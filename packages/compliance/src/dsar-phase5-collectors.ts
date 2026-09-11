import {
  getMemberProfile,
  listMemberBookings,
  listMemberNotificationPreferences,
  listMemberPayments,
} from "@eleva/db"
import { toCsv } from "./dsar-csv"
import {
  hasDsarCollector,
  registerDsarCollector,
  type DsarCollector,
} from "./dsar-collectors"
import { listMemberConsents } from "./member-consents"

export const PHASE5_DSAR_COLLECTOR_IDS = [
  "profile",
  "bookings",
  "payments",
  "consents",
  "notification_preferences",
] as const

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

async function collectAllPages<T>(
  fetchPage: (
    cursor?: string
  ) => Promise<{ items: T[]; nextCursor: string | null }>
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await fetchPage(cursor)
    items.push(...page.items)
    if (!page.nextCursor) return items
    cursor = page.nextCursor
  }
}

const phase5Collectors: DsarCollector[] = [
  {
    id: "profile",
    collect: async (userId) => {
      const profile = await getMemberProfile(userId)
      const json = profile
        ? {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            timezone: profile.timezone,
            locale: profile.locale,
            avatarUrl: profile.avatarUrl,
          }
        : { id: userId }
      return {
        filename: "profile",
        json,
        csv: toCsv([json]),
      }
    },
  },
  {
    id: "bookings",
    collect: async (userId, orgId) => {
      if (!orgId) {
        return { filename: "bookings", json: [], csv: toCsv([]) }
      }
      const [upcoming, past] = await Promise.all([
        collectAllPages((cursor) =>
          listMemberBookings({
            userId,
            orgId,
            range: "upcoming",
            limit: 50,
            cursor,
          })
        ),
        collectAllPages((cursor) =>
          listMemberBookings({
            userId,
            orgId,
            range: "past",
            limit: 50,
            cursor,
          })
        ),
      ])
      const json = [...upcoming, ...past].map((booking) => ({
        id: booking.id,
        orgId: booking.orgId,
        status: booking.status,
        startsAt: iso(booking.startsAt),
        endsAt: iso(booking.endsAt),
        timezone: booking.timezone,
        sessionMode: booking.sessionMode,
        priceCents: booking.priceCents,
        currency: booking.currency,
        expertUsername: booking.expert.username,
        eventSlug: booking.eventType.slug,
      }))
      return { filename: "bookings", json, csv: toCsv(json) }
    },
  },
  {
    id: "payments",
    collect: async (userId) => {
      const items = await collectAllPages((cursor) =>
        listMemberPayments({ userId, limit: 50, cursor })
      )
      const json = items.map((payment) => ({
        id: payment.id,
        bookingId: payment.bookingId,
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        paidAt: iso(payment.paidAt),
        refundedCents: payment.refundedCents,
        receiptUrl: payment.receiptUrl,
      }))
      return { filename: "payments", json, csv: toCsv(json) }
    },
  },
  {
    id: "consents",
    collect: async (userId) => {
      const rows = await listMemberConsents(userId)
      const json = rows.map((row) => ({
        kind: row.kind,
        version: row.version,
        grantedAt: iso(row.grantedAt),
        withdrawnAt: iso(row.withdrawnAt),
        source: row.source,
      }))
      return { filename: "consents", json, csv: toCsv(json) }
    },
  },
  {
    id: "notification_preferences",
    collect: async (userId) => {
      const json = (await listMemberNotificationPreferences(userId)).map(
        (row) => ({
          channel: row.channel,
          category: row.category,
          enabled: row.enabled,
          quietHoursStart: row.quietHoursStart,
          quietHoursEnd: row.quietHoursEnd,
          timezone: row.timezone,
        })
      )
      return {
        filename: "notification_preferences",
        json,
        csv: toCsv(json),
      }
    },
  },
]

export function ensurePhase5DsarCollectors(): void {
  for (const collector of phase5Collectors) {
    if (!hasDsarCollector(collector.id)) {
      registerDsarCollector(collector)
    }
  }
}
