import { createHash, randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { env } from "@eleva/config/env"
import { withAudit } from "@eleva/audit"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { organization } from "@eleva/db/schema/auth"
import { stripe } from "./client"
import { computeCommissionRate, ENTITLEMENT_KEYS } from "./commission"

export function hashReservationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

const funnelSnapshotSchema = z.object({
  timezone: z.string().min(1),
  language: z.string().min(1),
  memberCountry: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value)),
  bookingLinkId: z.string().uuid().nullable(),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  guest: z
    .object({
      email: z.string().email(),
      name: z.string().min(1),
      phone: z.string().optional(),
    })
    .optional(),
})

export function parseReservationFunnel(value: unknown) {
  return funnelSnapshotSchema.safeParse(value)
}

const bookingLinkIdSchema = z.string().uuid()

function funnelWithoutGuest(
  funnel: z.infer<typeof funnelSnapshotSchema>
): z.infer<typeof funnelSnapshotSchema> {
  const { guest: _guest, ...rest } = funnel
  return rest
}

export function paymentIntentIdempotencyKey(reservationId: string): string {
  return `pi:${reservationId}`
}

export function authorizeReservationAccess(input: {
  capabilityHash: string
  reservationToken: string
  reservationUserId: string | null
  sessionUserId?: string
  status: string
  expiresAt: Date
  linkRevoked: boolean
}): "ok" | "not_found" {
  if (hashReservationToken(input.reservationToken) !== input.capabilityHash) {
    return "not_found"
  }
  if (
    input.reservationUserId &&
    input.reservationUserId !== input.sessionUserId
  ) {
    return "not_found"
  }
  if (input.status !== "active") return "not_found"
  if (input.expiresAt.getTime() <= Date.now()) return "not_found"
  if (input.linkRevoked) return "not_found"
  return "ok"
}

export type CreateBookingPaymentIntentInput = {
  amountCents: number
  currency: string
  bookingId: string
  reservationId: string
  expertOrgId: string
  idempotencyKey: string
}

export async function createBookingPaymentIntent(
  input: CreateBookingPaymentIntentInput
): Promise<{ id: string; client_secret: string | null }> {
  const pmc = env().STRIPE_PMC_BOOKING
  if (!pmc) {
    throw new Error("STRIPE_PMC_BOOKING is not configured")
  }

  return stripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      payment_method_configuration: pmc,
      transfer_group: input.bookingId,
      metadata: {
        reservationId: input.reservationId,
        bookingId: input.bookingId,
        expertOrgId: input.expertOrgId,
        eleva_booking_id: input.bookingId,
      },
    },
    { idempotencyKey: input.idempotencyKey }
  )
}

export type CreatePaymentIntentForReservationInput = {
  reservationId: string
  reservationToken: string
  sessionUserId?: string
}

export type CreatePaymentIntentForReservationResult =
  | {
      ok: true
      clientSecret: string
      paymentIntentId: string
      bookingId: string
      publishableKey: string
    }
  | { ok: false; error: "not_found" | "unavailable" | "db_error" }

export async function createPaymentIntentForReservation(
  input: CreatePaymentIntentForReservationInput
): Promise<CreatePaymentIntentForReservationResult> {
  let loaded
  try {
    loaded = await loadReservationForIntent(input.reservationId)
  } catch (err) {
    console.error("[payments/intent] reservation load failed", err)
    return { ok: false, error: "db_error" }
  }
  if (!loaded) return { ok: false, error: "not_found" }

  const { reservation, orgType, linkRevoked } = loaded
  const access = authorizeReservationAccess({
    capabilityHash: reservation.capabilityHash,
    reservationToken: input.reservationToken,
    reservationUserId: reservation.userId,
    sessionUserId: input.sessionUserId,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    linkRevoked,
  })
  if (access === "not_found") {
    return { ok: false, error: "not_found" }
  }

  const parsedFunnel = parseReservationFunnel(reservation.funnel)
  const funnel = parsedFunnel.success ? parsedFunnel.data : null
  const priceCents = reservation.priceCents
  const currency = reservation.currency
  if (!funnel || priceCents == null || !currency) {
    return { ok: false, error: "unavailable" }
  }
  if (!reservation.userId && !funnel.guest?.email) {
    return { ok: false, error: "unavailable" }
  }

  const publishableKey = env().STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    return { ok: false, error: "unavailable" }
  }

  if (reservation.stripePaymentIntentId) {
    return reuseExistingIntent(
      reservation.stripePaymentIntentId,
      publishableKey
    )
  }

  if (!env().STRIPE_PMC_BOOKING) {
    return { ok: false, error: "unavailable" }
  }

  const existing = await loadBookingForReservation(
    reservation.orgId,
    reservation.id
  )
  let bookingId = existing?.bookingId ?? randomUUID()
  let paymentId = existing?.paymentId ?? randomUUID()
  const idempotencyKey = paymentIntentIdempotencyKey(reservation.id)
  const entitlements =
    orgType === "clinic" || orgType === "team"
      ? [ENTITLEMENT_KEYS.CLINIC_STARTER]
      : []
  const rate = computeCommissionRate({ entitlements })
  const applicationFeeCents = Math.round(priceCents * rate)

  if (!existing) {
    try {
      await withAudit(
        { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
        async (tx, ctx) => {
          await insertPendingBooking(tx, {
            bookingId,
            paymentId,
            reservation,
            funnel,
            priceCents,
            currency,
            applicationFeeCents,
            idempotencyKey,
          })
          await ctx.emit({
            entity: "booking",
            action: "created",
            entityId: bookingId,
            payload: {
              reservationId: reservation.id,
              applicationFeeCents,
              commissionRate: rate,
            },
          })
        }
      )
    } catch (err) {
      const raced = await loadBookingForReservation(
        reservation.orgId,
        reservation.id
      )
      if (!raced) {
        console.error("[payments/intent] tx A failed", err)
        return { ok: false, error: "db_error" }
      }
      bookingId = raced.bookingId
      paymentId = raced.paymentId
    }
  }

  let intent
  try {
    intent = await createBookingPaymentIntent({
      amountCents: priceCents,
      currency,
      bookingId,
      reservationId: reservation.id,
      expertOrgId: reservation.orgId,
      idempotencyKey,
    })
  } catch (err) {
    console.error("[payments/intent] Stripe create failed", err)
    return { ok: false, error: "unavailable" }
  }

  if (!intent.client_secret) {
    return { ok: false, error: "unavailable" }
  }

  try {
    await withAudit(
      { orgId: reservation.orgId, actorUserId: input.sessionUserId ?? null },
      async (tx, ctx) => {
        await bindPaymentIntent(tx, {
          reservationId: reservation.id,
          bookingId,
          paymentIntentId: intent.id,
        })
        await ctx.emit({
          entity: "booking_payment",
          action: "updated",
          entityId: paymentId,
          payload: { paymentIntentId: intent.id, status: "requires_payment" },
        })
      }
    )
  } catch (err) {
    console.error("[payments/intent] tx B failed", err)
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    bookingId,
    publishableKey,
  }
}

async function reuseExistingIntent(
  paymentIntentId: string,
  publishableKey: string
): Promise<CreatePaymentIntentForReservationResult> {
  try {
    const intent = await stripe().paymentIntents.retrieve(paymentIntentId)
    const bookingId = intent.metadata.bookingId
    const reusable =
      intent.status === "requires_payment_method" ||
      intent.status === "requires_confirmation" ||
      intent.status === "requires_action" ||
      intent.status === "processing"
    if (!intent.client_secret || !bookingId || !reusable) {
      return { ok: false, error: "unavailable" }
    }
    return {
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      bookingId,
      publishableKey,
    }
  } catch {
    return { ok: false, error: "unavailable" }
  }
}

async function loadReservationForIntent(reservationId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        reservation: main.slotReservations,
        orgType: organization.type,
      })
      .from(main.slotReservations)
      .innerJoin(organization, eq(organization.id, main.slotReservations.orgId))
      .where(eq(main.slotReservations.id, reservationId))
      .limit(1)

    if (!row) return null

    const rawLinkId = row.reservation.funnel?.bookingLinkId
    const bookingLinkId = bookingLinkIdSchema.safeParse(rawLinkId).success
      ? rawLinkId
      : null
    let linkRevoked = false
    if (bookingLinkId) {
      const [link] = await tx
        .select({ revokedAt: main.bookingLinks.revokedAt })
        .from(main.bookingLinks)
        .where(
          and(
            eq(main.bookingLinks.id, bookingLinkId),
            eq(main.bookingLinks.orgId, row.reservation.orgId)
          )
        )
        .limit(1)
      linkRevoked = Boolean(link?.revokedAt)
    }

    return {
      reservation: row.reservation,
      orgType: row.orgType,
      linkRevoked,
    }
  })
}

async function loadBookingForReservation(orgId: string, reservationId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        bookingId: main.bookings.id,
        paymentId: main.bookingPayments.id,
      })
      .from(main.bookings)
      .innerJoin(
        main.bookingPayments,
        eq(main.bookingPayments.bookingId, main.bookings.id)
      )
      .where(
        and(
          eq(main.bookings.orgId, orgId),
          eq(main.bookings.reservationId, reservationId)
        )
      )
      .limit(1)
    return row ?? null
  })
}

async function insertPendingBooking(
  tx: Tx,
  input: {
    bookingId: string
    paymentId: string
    reservation: typeof main.slotReservations.$inferSelect
    funnel: z.infer<typeof funnelSnapshotSchema>
    priceCents: number
    currency: string
    applicationFeeCents: number
    idempotencyKey: string
  }
) {
  const { reservation, funnel } = input
  await tx.insert(main.bookings).values({
    id: input.bookingId,
    orgId: reservation.orgId,
    eventTypeId: reservation.eventTypeId,
    expertProfileId: reservation.expertProfileId,
    expertUserId: reservation.expertUserId,
    reservationId: reservation.id,
    memberUserId: reservation.userId,
    guestEmail: funnel.guest?.email,
    guestName: funnel.guest?.name,
    guestPhone: funnel.guest?.phone,
    eventTypeModeId: reservation.eventTypeModeId,
    language: funnel.language,
    memberCountry: funnel.memberCountry,
    bookingLinkId: funnel.bookingLinkId,
    priceCents: input.priceCents,
    priceAmount: input.priceCents,
    currency: input.currency,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    timezone: funnel.timezone,
    status: "pending_payment",
    sessionMode: funnel.sessionMode,
    bookedLocale: funnel.language,
  })
  await tx.insert(main.bookingPayments).values({
    id: input.paymentId,
    orgId: reservation.orgId,
    bookingId: input.bookingId,
    status: "intent_pending",
    amountCents: input.priceCents,
    applicationFeeCents: input.applicationFeeCents,
    transferGroup: input.bookingId,
    stripeIdempotencyKey: input.idempotencyKey,
  })
  await tx
    .update(main.slotReservations)
    .set({ funnel: funnelWithoutGuest(funnel) })
    .where(eq(main.slotReservations.id, reservation.id))
}

async function bindPaymentIntent(
  tx: Tx,
  input: {
    reservationId: string
    bookingId: string
    paymentIntentId: string
  }
) {
  await tx
    .update(main.slotReservations)
    .set({ stripePaymentIntentId: input.paymentIntentId })
    .where(eq(main.slotReservations.id, input.reservationId))
  await tx
    .update(main.bookings)
    .set({
      stripePaymentIntentId: input.paymentIntentId,
      status: "pending_payment",
    })
    .where(eq(main.bookings.id, input.bookingId))
  await tx
    .update(main.bookingPayments)
    .set({
      stripePaymentIntentId: input.paymentIntentId,
      status: "requires_payment",
    })
    .where(eq(main.bookingPayments.bookingId, input.bookingId))
}
