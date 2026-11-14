import { and, eq } from "drizzle-orm"
import { CANCELLATION_POLICY_VERSION } from "@eleva/config/cancellation-policy"
import { withPlatformAdminContext, type Tx } from "../context"
import * as auth from "../schema/auth"
import * as main from "../schema/main"

/**
 * Seed-only sessions for the demo member, so member and expert dashboards
 * are judged with real content: one paid video visit coming up and two
 * past sessions. Times are relative to the seed run; re-run the seed before
 * a capture. Fixed ids keep it idempotent (rows are updated, not added).
 */
export const DEMO_MEMBER_EMAIL = "member.demo@example.test"

type DemoSession = {
  id: string
  paymentId: string
  username: string
  eventSlug: string
  /** Days from today; negative is in the past. */
  dayOffset: number
  /** Start time, Lisbon wall clock. */
  hour: number
  status: "confirmed" | "completed"
}

const SESSIONS: DemoSession[] = [
  {
    id: "5eed0000-0000-4000-8000-000000000001",
    paymentId: "5eed0000-0000-4000-8000-000000000101",
    username: "fisiomota",
    eventSlug: "first-visit",
    dayOffset: 3,
    hour: 10,
    status: "confirmed",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000002",
    paymentId: "5eed0000-0000-4000-8000-000000000102",
    username: "anaquick",
    eventSlug: "quick-chat",
    dayOffset: -9,
    hour: 15,
    status: "completed",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000003",
    paymentId: "5eed0000-0000-4000-8000-000000000103",
    username: "joanalima",
    eventSlug: "first-consultation",
    dayOffset: -23,
    hour: 11,
    status: "completed",
  },
]

/** A weekday `dayOffset` days away at `hour`:00 in Lisbon (UTC+0 or +1). */
function sessionStart(dayOffset: number, hour: number): Date {
  const day = new Date()
  day.setUTCDate(day.getUTCDate() + dayOffset)
  // Move weekends to the next Monday so the time is inside working hours.
  const weekday = day.getUTCDay()
  if (weekday === 6) day.setUTCDate(day.getUTCDate() + 2)
  if (weekday === 0) day.setUTCDate(day.getUTCDate() + 1)
  const lisbonOffset = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(
      new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12)
      )
    )
  )
  // Lisbon is UTC+0 in winter and UTC+1 in summer.
  const shift = lisbonOffset - 12
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour - shift
    )
  )
}

async function loadOffer(tx: Tx, username: string, eventSlug: string) {
  const [row] = await tx
    .select({
      orgId: main.expertProfiles.orgId,
      expertProfileId: main.expertProfiles.id,
      expertUserId: main.expertProfiles.userId,
      eventTypeId: main.eventTypes.id,
      durationMinutes: main.eventTypes.durationMinutes,
      priceAmount: main.eventTypes.priceAmount,
    })
    .from(main.expertProfiles)
    .innerJoin(
      main.eventTypes,
      eq(main.eventTypes.expertProfileId, main.expertProfiles.id)
    )
    .where(
      and(
        eq(main.expertProfiles.username, username),
        eq(main.eventTypes.slug, eventSlug)
      )
    )
    .limit(1)
  if (!row) throw new Error(`demo session offer ${username}/${eventSlug}`)
  const [mode] = await tx
    .select({ id: main.eventTypeModes.id })
    .from(main.eventTypeModes)
    .where(
      and(
        eq(main.eventTypeModes.eventTypeId, row.eventTypeId),
        eq(main.eventTypeModes.mode, "online")
      )
    )
    .limit(1)
  return { ...row, modeId: mode?.id ?? null }
}

export async function seedDemoMemberSessions(): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    const [member] = await tx
      .select({ userId: auth.user.id, orgId: auth.member.organizationId })
      .from(auth.user)
      .innerJoin(auth.member, eq(auth.member.userId, auth.user.id))
      .innerJoin(
        auth.organization,
        eq(auth.organization.id, auth.member.organizationId)
      )
      .where(
        and(
          eq(auth.user.email, DEMO_MEMBER_EMAIL),
          eq(auth.organization.type, "personal")
        )
      )
      .limit(1)
    if (!member) throw new Error("demo member Space is missing")

    for (const session of SESSIONS) {
      const offer = await loadOffer(tx, session.username, session.eventSlug)
      const startsAt = sessionStart(session.dayOffset, session.hour)
      const endsAt = new Date(
        startsAt.getTime() + offer.durationMinutes * 60_000
      )
      const timing = {
        startsAt,
        endsAt,
        status: session.status,
        confirmedAt: new Date(startsAt.getTime() - 7 * 86_400_000),
        completedAt: session.status === "completed" ? endsAt : null,
      }
      const [existing] = await tx
        .select({ id: main.bookings.id })
        .from(main.bookings)
        .where(eq(main.bookings.id, session.id))
        .limit(1)
      if (existing) {
        await tx
          .update(main.bookings)
          .set(timing)
          .where(eq(main.bookings.id, session.id))
      } else {
        await tx.insert(main.bookings).values({
          id: session.id,
          orgId: offer.orgId,
          eventTypeId: offer.eventTypeId,
          expertProfileId: offer.expertProfileId,
          expertUserId: offer.expertUserId,
          memberUserId: member.userId,
          counterpartyOrgId: member.orgId,
          eventTypeModeId: offer.modeId,
          language: "en",
          memberCountry: "PT",
          priceCents: offer.priceAmount,
          priceAmount: offer.priceAmount,
          currency: "EUR",
          timezone: "Europe/Lisbon",
          sessionMode: "online",
          bookedLocale: "en",
          cancellationPolicy: "flexible",
          cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
          ...timing,
        })
      }
      await tx
        .insert(main.bookingPayments)
        .values({
          id: session.paymentId,
          orgId: offer.orgId,
          bookingId: session.id,
          status: "succeeded",
          amountCents: offer.priceAmount,
          applicationFeeCents: 0,
          appliedCommissionBps: 0,
          platformFeeNetCents: 0,
          platformFeeVatCents: 0,
          processingFeeCents: 0,
          transferGroup: session.id,
          stripeIdempotencyKey: `seed:${session.id}`,
          paymentMethodType: offer.priceAmount === 0 ? "free" : "card",
          paidAt: timing.confirmedAt,
        })
        .onConflictDoNothing()
    }
  })
}
