import { and, eq } from "drizzle-orm"
import { CANCELLATION_POLICY_VERSION } from "@eleva/config/cancellation-policy"
import { withPlatformAdminContext, type Tx } from "../context"
import * as auth from "../schema/auth"
import * as main from "../schema/main"

/**
 * Seed-only sessions for the demo member, so member and expert dashboards
 * are judged with real content: two coming up (video, phone) and two past
 * (in person, video). They use free offers only and record the same `free`
 * payment the real free flow writes, so no seeded row ever looks like money
 * that moved: payout, fee, refund and reconciliation jobs have nothing to
 * pick up. Times are relative to the seed run; re-run the seed before a
 * capture. Fixed ids keep it idempotent (rows are updated, not added).
 */
export const DEMO_MEMBER_EMAIL = "member.demo@example.test"

type DemoSession = {
  id: string
  paymentId: string
  username: string
  eventSlug: string
  mode: "online" | "phone" | "in_person"
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
    username: "martasousa",
    eventSlug: "intro-call",
    mode: "online",
    dayOffset: 3,
    hour: 10,
    status: "confirmed",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000002",
    paymentId: "5eed0000-0000-4000-8000-000000000102",
    username: "anaquick",
    eventSlug: "quick-chat",
    mode: "phone",
    dayOffset: 6,
    hour: 16,
    status: "confirmed",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000003",
    paymentId: "5eed0000-0000-4000-8000-000000000103",
    username: "martasousa",
    eventSlug: "intro-call",
    mode: "in_person",
    dayOffset: -9,
    hour: 11,
    status: "completed",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000004",
    paymentId: "5eed0000-0000-4000-8000-000000000104",
    username: "anaquick",
    eventSlug: "quick-chat",
    mode: "online",
    dayOffset: -23,
    hour: 15,
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

async function loadOffer(
  tx: Tx,
  username: string,
  eventSlug: string,
  mode: DemoSession["mode"]
) {
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
  if (row.priceAmount !== 0) {
    throw new Error(`demo sessions use free offers only: ${eventSlug}`)
  }
  const [found] = await tx
    .select({ id: main.eventTypeModes.id })
    .from(main.eventTypeModes)
    .where(
      and(
        eq(main.eventTypeModes.eventTypeId, row.eventTypeId),
        eq(main.eventTypeModes.mode, mode)
      )
    )
    .limit(1)
  if (!found) throw new Error(`demo session mode ${eventSlug}/${mode}`)
  return { ...row, modeId: found.id }
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
      const offer = await loadOffer(
        tx,
        session.username,
        session.eventSlug,
        session.mode
      )
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
          .set({
            ...timing,
            eventTypeId: offer.eventTypeId,
            eventTypeModeId: offer.modeId,
            expertProfileId: offer.expertProfileId,
            expertUserId: offer.expertUserId,
            orgId: offer.orgId,
            priceCents: 0,
            priceAmount: 0,
            sessionMode: session.mode,
          })
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
          priceCents: 0,
          priceAmount: 0,
          currency: "EUR",
          timezone: "Europe/Lisbon",
          sessionMode: session.mode,
          bookedLocale: "en",
          cancellationPolicy: "flexible",
          cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
          ...timing,
        })
      }
      // The same row the real free flow writes (`confirm-free.ts`).
      const payment = {
        orgId: offer.orgId,
        bookingId: session.id,
        status: "succeeded" as const,
        amountCents: 0,
        applicationFeeCents: 0,
        appliedCommissionBps: 0,
        platformFeeNetCents: 0,
        platformFeeVatCents: 0,
        processingFeeCents: 0,
        transferGroup: session.id,
        stripeIdempotencyKey: `free:seed:${session.id}`,
        paymentMethodType: "free",
        paidAt: timing.confirmedAt,
      }
      await tx
        .insert(main.bookingPayments)
        .values({ id: session.paymentId, ...payment })
        .onConflictDoUpdate({
          target: main.bookingPayments.id,
          set: payment,
        })
    }
  })
}
