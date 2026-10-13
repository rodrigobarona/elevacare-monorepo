import { and, asc, eq, lte } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import { bookingPayments, bookings } from "../schema/main"

export type ExpertBookingApprovalRow = {
  id: string
  orgId: string
  status: (typeof bookings.$inferSelect)["status"]
  startsAt: Date
  endsAt: Date
  eventTypeId: string
  expertProfileId: string
  memberUserId: string | null
  sessionMode: (typeof bookings.$inferSelect)["sessionMode"]
  reservationId: string | null
  requiresApproval: boolean
  approvalDeadlineAt: Date | null
  paymentId: string | null
  paymentStatus: (typeof bookingPayments.$inferSelect)["status"] | null
  paymentAmountCents: number | null
  paymentRefundedCents: number | null
}

export async function getExpertBookingForApproval(input: {
  orgId: string
  expertProfileId: string
  bookingId: string
}): Promise<ExpertBookingApprovalRow | null> {
  return withOrgContext(input.orgId, async (tx) =>
    loadApprovalRow(tx, input.orgId, input.expertProfileId, input.bookingId)
  )
}

export async function listExpiredBookingRequests(input: {
  now: Date
  limit: number
}): Promise<ExpertBookingApprovalRow[]> {
  return withPlatformAdminContext(async (tx) => {
    return tx
      .select({
        id: bookings.id,
        orgId: bookings.orgId,
        status: bookings.status,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        eventTypeId: bookings.eventTypeId,
        expertProfileId: bookings.expertProfileId,
        memberUserId: bookings.memberUserId,
        sessionMode: bookings.sessionMode,
        reservationId: bookings.reservationId,
        requiresApproval: bookings.requiresApproval,
        approvalDeadlineAt: bookings.approvalDeadlineAt,
        paymentId: bookingPayments.id,
        paymentStatus: bookingPayments.status,
        paymentAmountCents: bookingPayments.amountCents,
        paymentRefundedCents: bookingPayments.refundedCents,
      })
      .from(bookings)
      .leftJoin(
        bookingPayments,
        and(
          eq(bookingPayments.bookingId, bookings.id),
          eq(bookingPayments.orgId, bookings.orgId)
        )
      )
      .where(
        and(
          eq(bookings.status, "awaiting_confirmation"),
          lte(bookings.approvalDeadlineAt, input.now)
        )
      )
      .orderBy(asc(bookings.approvalDeadlineAt), asc(bookings.id))
      .limit(input.limit)
  })
}

async function loadApprovalRow(
  tx: Tx,
  orgId: string,
  expertProfileId: string,
  bookingId: string
): Promise<ExpertBookingApprovalRow | null> {
  const [row] = await tx
    .select({
      id: bookings.id,
      orgId: bookings.orgId,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      eventTypeId: bookings.eventTypeId,
      expertProfileId: bookings.expertProfileId,
      memberUserId: bookings.memberUserId,
      sessionMode: bookings.sessionMode,
      reservationId: bookings.reservationId,
      requiresApproval: bookings.requiresApproval,
      approvalDeadlineAt: bookings.approvalDeadlineAt,
      paymentId: bookingPayments.id,
      paymentStatus: bookingPayments.status,
      paymentAmountCents: bookingPayments.amountCents,
      paymentRefundedCents: bookingPayments.refundedCents,
    })
    .from(bookings)
    .leftJoin(
      bookingPayments,
      and(
        eq(bookingPayments.bookingId, bookings.id),
        eq(bookingPayments.orgId, bookings.orgId)
      )
    )
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.orgId, orgId),
        eq(bookings.expertProfileId, expertProfileId)
      )
    )
    .limit(1)
  return row ?? null
}
