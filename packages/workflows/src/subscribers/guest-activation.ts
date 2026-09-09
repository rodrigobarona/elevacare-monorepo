import { and, eq, isNull } from "drizzle-orm"
import { hashGuestEmail } from "@eleva/compliance"
import { provisionPersonalSpace } from "@eleva/auth"
import { requestMagicLinkSignIn } from "@eleva/auth/server/auth"
import { withAudit } from "@eleva/audit"
import { auth, db, main, withOrgContext } from "@eleva/db"
import type { GuestActivationPayload } from "../domain-events"

export type GuestActivationInput = GuestActivationPayload & { orgId: string }

export type GuestActivationDeps = {
  sendMagicLink?: (email: string) => Promise<void>
}

export async function activateGuestBooking(
  payload: GuestActivationInput,
  deps: GuestActivationDeps = {}
): Promise<void> {
  const [booking] = await withOrgContext(payload.orgId, async (tx) =>
    tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        memberUserId: main.bookings.memberUserId,
        guestEmail: main.bookings.guestEmail,
        guestName: main.bookings.guestName,
        status: main.bookings.status,
        guestActivationSentAt: main.bookings.guestActivationSentAt,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, payload.bookingId))
      .limit(1)
  )

  if (!booking || booking.status !== "confirmed") return

  const email = booking.guestEmail?.trim().toLowerCase()
  if (!email) return
  if (booking.guestActivationSentAt) return
  if (booking.memberUserId) {
    await sendActivationLink(email, deps)
    await markActivationSent(booking.orgId, booking.id)
    return
  }

  const user = await findOrCreateUser({
    email,
    name: booking.guestName ?? "Member",
  })
  await provisionPersonalSpace({ id: user.id, name: user.name })
  const space = await findPersonalSpace(user.id)

  await withAudit(
    { orgId: booking.orgId, actorUserId: user.id },
    async (tx, ctx) => {
      await tx
        .update(main.bookings)
        .set({
          memberUserId: user.id,
          counterpartyOrgId: space?.orgId ?? null,
        })
        .where(eq(main.bookings.id, booking.id))
      await tx
        .update(main.consents)
        .set({
          userId: user.id,
          subjectKind: "user",
        })
        .where(
          and(
            eq(main.consents.orgId, booking.orgId),
            eq(main.consents.guestEmailHash, hashGuestEmail(email)),
            isNull(main.consents.userId)
          )
        )
      await ctx.emit({
        entity: "booking",
        action: "updated",
        entityId: booking.id,
        payload: { guestActivated: true, userId: user.id },
      })
    }
  )

  await sendActivationLink(email, deps)
  await markActivationSent(booking.orgId, booking.id)
}

async function markActivationSent(orgId: string, bookingId: string) {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(main.bookings)
      .set({ guestActivationSentAt: new Date() })
      .where(eq(main.bookings.id, bookingId))
  })
}

async function findOrCreateUser(input: { email: string; name: string }) {
  const [existing] = await db()
    .select({ id: auth.user.id, name: auth.user.name })
    .from(auth.user)
    .where(eq(auth.user.email, input.email))
    .limit(1)
  if (existing) return existing

  const [created] = await db()
    .insert(auth.user)
    .values({
      name: input.name,
      email: input.email,
      emailVerified: false,
    })
    .onConflictDoNothing()
    .returning({ id: auth.user.id, name: auth.user.name })
  if (created) return created

  const [raced] = await db()
    .select({ id: auth.user.id, name: auth.user.name })
    .from(auth.user)
    .where(eq(auth.user.email, input.email))
    .limit(1)
  if (!raced) throw new Error("guest activation: user insert raced without row")
  return raced
}

async function findPersonalSpace(userId: string) {
  const [row] = await db()
    .select({ orgId: auth.organization.id })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, auth.member.organizationId)
    )
    .where(
      and(
        eq(auth.member.userId, userId),
        eq(auth.organization.type, "personal")
      )
    )
    .limit(1)
  return row ?? null
}

async function sendActivationLink(email: string, deps: GuestActivationDeps) {
  if (deps.sendMagicLink) {
    await deps.sendMagicLink(email)
    return
  }
  await requestMagicLinkSignIn({
    email,
    callbackURL: "/account/activate",
  })
}
