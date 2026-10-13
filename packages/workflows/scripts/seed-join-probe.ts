import { createHash, randomBytes, randomUUID } from "node:crypto"
import { and, eq, gt, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { provisionPersonalSpace } from "@eleva/auth"
import {
  auth,
  db,
  main,
  withOrgContext,
  withPlatformAdminContext,
} from "@eleva/db"
import { mintJoinGrant, sessionJoinPath } from "@eleva/video/join-grant"
import { ensureSessionRoom } from "@eleva/workflows/video"

const EXPERT_EMAIL = "rbarona@hey.com"
const EXPERT_NAME = "Rodrigo Barona"
const ORG_SLUG = "rbarona"
const USERNAME = "rbarona"
const EVENT_SLUG = "hey"
const EVENT_TITLE = "Rodrigo Barona HEY"
const GUEST_EMAIL = "tonight.guest@example.test"
const GUEST_NAME = "Tonight Guest"
const TIMEZONE = "Europe/Lisbon"
const DURATION_MINUTES = 60
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const
/** Tonight 21:30 Europe/Lisbon (WEST, UTC+1 on 12 Oct 2026). */
const TONIGHT_START = new Date("2026-10-12T21:30:00+01:00")

async function upsertUser(email: string, name: string, emailVerified: boolean) {
  const [existing] = await db()
    .select({ id: auth.user.id, name: auth.user.name })
    .from(auth.user)
    .where(eq(auth.user.email, email))
    .limit(1)
  if (existing) return existing
  const [inserted] = await db()
    .insert(auth.user)
    .values({ name, email, emailVerified })
    .returning({ id: auth.user.id, name: auth.user.name })
  return inserted!
}

async function upsertExpertOrg(
  expertUserId: string,
  slug: string,
  name: string
) {
  const [membership] = await db()
    .select({
      id: auth.organization.id,
      slug: auth.organization.slug,
    })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, auth.member.organizationId)
    )
    .where(
      and(
        eq(auth.member.userId, expertUserId),
        eq(auth.organization.type, "expert")
      )
    )
    .limit(1)
  if (membership) return membership
  const [bySlug] = await db()
    .select({ id: auth.organization.id, slug: auth.organization.slug })
    .from(auth.organization)
    .where(eq(auth.organization.slug, slug))
    .limit(1)
  if (bySlug) return bySlug
  const [inserted] = await db()
    .insert(auth.organization)
    .values({ name, slug, type: "expert" })
    .returning({ id: auth.organization.id, slug: auth.organization.slug })
  return inserted!
}

async function ensureMembership(userId: string, orgId: string) {
  const [existing] = await db()
    .select({ id: auth.member.id })
    .from(auth.member)
    .where(
      and(eq(auth.member.userId, userId), eq(auth.member.organizationId, orgId))
    )
    .limit(1)
  if (existing) return
  await db().insert(auth.member).values({
    userId,
    organizationId: orgId,
    role: "owner",
  })
}

async function seedTonightJoinProbe() {
  if (!process.env.DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is required to open a tonight join room")
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required to mint join grants")
  }

  const expert = await upsertUser(EXPERT_EMAIL, EXPERT_NAME, true)
  const expertOrg = await upsertExpertOrg(
    expert.id,
    ORG_SLUG,
    `${EXPERT_NAME}'s practice`
  )
  const orgId = expertOrg.id
  await ensureMembership(expert.id, orgId)

  const guest = await upsertUser(GUEST_EMAIL, GUEST_NAME, false)
  await provisionPersonalSpace({ id: guest.id, name: guest.name })
  const [guestSpace] = await db()
    .select({ orgId: auth.organization.id })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, auth.member.organizationId)
    )
    .where(
      and(
        eq(auth.member.userId, guest.id),
        eq(auth.organization.type, "personal")
      )
    )
    .limit(1)
  if (!guestSpace) {
    throw new Error("guest Space missing after provision")
  }

  const ids = await withOrgContext(orgId, async (tx) => {
    const [existingProfile] = await tx
      .select({ id: main.expertProfiles.id })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.userId, expert.id))
      .limit(1)
    let expertProfileId = existingProfile?.id
    if (!expertProfileId) {
      const [inserted] = await tx
        .insert(main.expertProfiles)
        .values({
          orgId,
          userId: expert.id,
          username: USERNAME,
          displayName: EXPERT_NAME,
          headline: EVENT_TITLE,
          languages: ["en", "pt"],
          practiceCountry: "PT",
          practiceCountries: ["PT"],
          serviceCountries: ["PT"],
          worldwideRemote: true,
          worldwideMode: true,
          sessionModes: ["online"],
          timezone: TIMEZONE,
          status: "active",
        })
        .returning({ id: main.expertProfiles.id })
      expertProfileId = inserted!.id
    } else {
      await tx
        .update(main.expertProfiles)
        .set({
          displayName: EXPERT_NAME,
          headline: EVENT_TITLE,
          status: "active",
          worldwideRemote: true,
        })
        .where(eq(main.expertProfiles.id, expertProfileId))
    }

    const [existingSchedule] = await tx
      .select({ id: main.schedules.id })
      .from(main.schedules)
      .where(
        and(
          eq(main.schedules.expertProfileId, expertProfileId),
          eq(main.schedules.name, "Online")
        )
      )
      .limit(1)
    let scheduleId = existingSchedule?.id
    if (!scheduleId) {
      const [inserted] = await tx
        .insert(main.schedules)
        .values({
          orgId,
          expertProfileId,
          name: "Online",
          timezone: TIMEZONE,
          isDefault: true,
        })
        .returning({ id: main.schedules.id })
      scheduleId = inserted!.id
    }
    for (const dayOfWeek of WEEKDAYS) {
      const [rule] = await tx
        .select({ id: main.availabilityRules.id })
        .from(main.availabilityRules)
        .where(
          and(
            eq(main.availabilityRules.scheduleId, scheduleId),
            eq(main.availabilityRules.dayOfWeek, dayOfWeek)
          )
        )
        .limit(1)
      if (rule) {
        await tx
          .update(main.availabilityRules)
          .set({ startTime: "09:00:00", endTime: "23:00:00" })
          .where(eq(main.availabilityRules.id, rule.id))
      } else {
        await tx.insert(main.availabilityRules).values({
          orgId,
          scheduleId,
          dayOfWeek,
          startTime: "09:00:00",
          endTime: "23:00:00",
        })
      }
    }

    const [existingEvent] = await tx
      .select({ id: main.eventTypes.id })
      .from(main.eventTypes)
      .where(
        and(
          eq(main.eventTypes.expertProfileId, expertProfileId),
          eq(main.eventTypes.slug, EVENT_SLUG)
        )
      )
      .limit(1)
    let eventTypeId = existingEvent?.id
    if (!eventTypeId) {
      const [inserted] = await tx
        .insert(main.eventTypes)
        .values({
          orgId,
          expertProfileId,
          slug: EVENT_SLUG,
          title: { en: EVENT_TITLE, pt: EVENT_TITLE, es: EVENT_TITLE },
          kind: "non_clinical",
          visibility: "public",
          durationMinutes: DURATION_MINUTES,
          priceAmount: 0,
          currency: "EUR",
          languages: ["en", "pt"],
          published: true,
          active: true,
          worldwideMode: true,
          minimumNoticeMinutes: 0,
        })
        .returning({ id: main.eventTypes.id })
      eventTypeId = inserted!.id
    } else {
      await tx
        .update(main.eventTypes)
        .set({
          title: { en: EVENT_TITLE, pt: EVENT_TITLE, es: EVENT_TITLE },
          published: true,
          active: true,
          durationMinutes: DURATION_MINUTES,
          priceAmount: 0,
        })
        .where(eq(main.eventTypes.id, eventTypeId))
    }

    const [existingMode] = await tx
      .select({ id: main.eventTypeModes.id })
      .from(main.eventTypeModes)
      .where(
        and(
          eq(main.eventTypeModes.eventTypeId, eventTypeId),
          eq(main.eventTypeModes.mode, "online")
        )
      )
      .limit(1)
    let eventTypeModeId = existingMode?.id
    if (!eventTypeModeId) {
      const [inserted] = await tx
        .insert(main.eventTypeModes)
        .values({
          orgId,
          eventTypeId,
          mode: "online",
          scheduleId,
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: ["en", "pt"],
          sortOrder: 0,
          active: true,
        })
        .returning({ id: main.eventTypeModes.id })
      eventTypeModeId = inserted!.id
    }

    return { expertProfileId, eventTypeId, eventTypeModeId }
  })

  await withPlatformAdminContext(async (tx) => {
    const [inserted] = await tx
      .insert(main.publicHandles)
      .values({
        handle: USERNAME,
        ownerKind: "expert",
        ownerId: ids.expertProfileId,
      })
      .onConflictDoNothing()
      .returning({ ownerId: main.publicHandles.ownerId })
    if (inserted) return
    const [existing] = await tx
      .select({
        ownerKind: main.publicHandles.ownerKind,
        ownerId: main.publicHandles.ownerId,
      })
      .from(main.publicHandles)
      .where(eq(main.publicHandles.handle, USERNAME))
      .limit(1)
    if (
      !existing ||
      existing.ownerKind !== "expert" ||
      existing.ownerId !== ids.expertProfileId
    ) {
      throw new Error(`public handle ${USERNAME} belongs to another owner`)
    }
  })

  const now = new Date()
  const [live] = await withOrgContext(orgId, async (tx) =>
    tx
      .select({
        id: main.bookings.id,
        reservationId: main.bookings.reservationId,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        scheduleRevision: main.bookings.scheduleRevision,
      })
      .from(main.bookings)
      .where(
        and(
          eq(main.bookings.expertProfileId, ids.expertProfileId),
          eq(main.bookings.eventTypeId, ids.eventTypeId),
          inArray(main.bookings.status, ["confirmed", "rescheduled"]),
          gt(main.bookings.endsAt, now)
        )
      )
      .limit(1)
  )

  const targetStart = TONIGHT_START
  const targetEnd = new Date(targetStart.getTime() + DURATION_MINUTES * 60_000)

  let bookingId = live?.id
  const startsAt = targetStart
  const endsAt = targetEnd
  let scheduleRevision = live?.scheduleRevision ?? 0

  if (live && live.startsAt.getTime() !== targetStart.getTime()) {
    scheduleRevision = live.scheduleRevision + 1
    await withAudit({ orgId, actorUserId: expert.id }, async (tx, ctx) => {
      await tx
        .update(main.bookings)
        .set({
          startsAt: targetStart,
          endsAt: targetEnd,
          status: "rescheduled",
          scheduleRevision,
          updatedAt: now,
        })
        .where(eq(main.bookings.id, live.id))
      if (live.reservationId) {
        await tx
          .update(main.slotReservations)
          .set({ startsAt: targetStart, endsAt: targetEnd })
          .where(eq(main.slotReservations.id, live.reservationId))
      }
      await ctx.emit({
        entity: "booking",
        action: "rescheduled",
        entityId: live.id,
        payload: {
          joinProbe: true,
          from: live.startsAt.toISOString(),
          to: targetStart.toISOString(),
        },
      })
    })
  }

  if (!bookingId) {
    bookingId = randomUUID()
    const reservationId = randomUUID()
    const paymentId = randomUUID()
    const holdToken = randomBytes(32).toString("hex")
    const capabilityHash = createHash("sha256")
      .update(randomBytes(32))
      .digest("hex")

    await withAudit({ orgId, actorUserId: expert.id }, async (tx, ctx) => {
      await tx.insert(main.slotReservations).values({
        id: reservationId,
        orgId,
        eventTypeId: ids.eventTypeId,
        expertProfileId: ids.expertProfileId,
        expertUserId: expert.id,
        userId: guest.id,
        eventTypeModeId: ids.eventTypeModeId,
        priceCents: 0,
        currency: "EUR",
        startsAt,
        endsAt,
        expiresAt: new Date(now.getTime() + 5 * 60_000),
        holdToken,
        capabilityHash,
        status: "converted",
        cancellationPolicy: "flexible",
        funnel: {
          timezone: TIMEZONE,
          language: "en",
          memberCountry: "PT",
          bookingLinkId: null,
          sessionMode: "online",
          guest: { email: GUEST_EMAIL, name: GUEST_NAME },
        },
      })
      await tx.insert(main.bookings).values({
        id: bookingId,
        orgId,
        eventTypeId: ids.eventTypeId,
        expertProfileId: ids.expertProfileId,
        expertUserId: expert.id,
        reservationId,
        memberUserId: guest.id,
        counterpartyOrgId: guestSpace.orgId,
        guestEmail: GUEST_EMAIL,
        guestName: GUEST_NAME,
        eventTypeModeId: ids.eventTypeModeId,
        language: "en",
        memberCountry: "PT",
        priceCents: 0,
        priceAmount: 0,
        currency: "EUR",
        startsAt,
        endsAt,
        timezone: TIMEZONE,
        status: "confirmed",
        confirmedAt: now,
        sessionMode: "online",
        bookedLocale: "en",
        cancellationPolicy: "flexible",
        cancellationPolicyVersion: 1,
        guestActivationSentAt: now,
      })
      await tx.insert(main.bookingPayments).values({
        id: paymentId,
        orgId,
        bookingId,
        status: "succeeded",
        amountCents: 0,
        applicationFeeCents: 0,
        appliedCommissionBps: 0,
        platformFeeNetCents: 0,
        platformFeeVatCents: 0,
        processingFeeCents: 0,
        transferGroup: bookingId,
        stripeIdempotencyKey: `join-probe:${bookingId}`,
        paymentMethodType: "free",
        paidAt: now,
      })
      await tx
        .update(main.slotReservations)
        .set({ bookingId })
        .where(eq(main.slotReservations.id, reservationId))
      await ctx.emit({
        entity: "booking",
        action: "confirmed",
        entityId: bookingId,
        payload: { joinProbe: true, free: true },
      })
    })
  }

  const room = await ensureSessionRoom(bookingId)
  if (!("ok" in room)) {
    throw new Error(`Daily room not ready: ${JSON.stringify(room)}`)
  }

  const grant = await mintJoinGrant({
    bookingId,
    role: "member",
    endsAt,
    scheduleRevision,
  })
  const gateway = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "")
  const guestPath = sessionJoinPath(bookingId, grant)

  console.log("Tonight join probe is ready (standard Daily, not HIPAA).")
  console.log(`Event: ${EVENT_TITLE}`)
  console.log(`Expert: ${EXPERT_EMAIL} (${ORG_SLUG})`)
  console.log(`Starts: ${startsAt.toISOString()}`)
  console.log(`Ends:   ${endsAt.toISOString()}`)
  console.log(`Room:   ${room.roomName}`)
  console.log("")
  console.log("1. Expert (signed in as rbarona@hey.com):")
  console.log(`   ${gateway}/${expertOrg.slug}/team/sessions/${bookingId}/join`)
  console.log("")
  console.log("2. Guest (incognito, no login):")
  console.log(`   ${gateway}${guestPath}`)
}

seedTonightJoinProbe().catch((err) => {
  console.error(err)
  process.exit(1)
})
