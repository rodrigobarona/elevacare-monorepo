import { createHmac } from "node:crypto"
import { and, eq, isNotNull } from "drizzle-orm"
import { withPlatformAdminContext, type Tx } from "@eleva/db"
import { consents } from "@eleva/db/schema"

/** Product grace for `scheduled_for`. Not the clinical retention period. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14

const RETENTION_PSEUDONYM_KEY_MIN_LENGTH = 32

export function subjectPseudonymForUser(
  userId: string,
  secret: string | undefined = process.env.RETENTION_PSEUDONYM_KEY
): Buffer {
  if (!secret || secret.length < RETENTION_PSEUDONYM_KEY_MIN_LENGTH) {
    throw new Error(
      "RETENTION_PSEUDONYM_KEY is not configured with at least 32 characters"
    )
  }
  return createHmac("sha256", secret).update(userId).digest()
}

async function pseudonymiseBookingConsentsInTx(
  tx: Tx,
  userId: string,
  token: Buffer
): Promise<void> {
  await tx
    .update(consents)
    .set({
      userId: null,
      guestEmailHash: null,
      subjectPseudonym: token,
    })
    .where(and(eq(consents.userId, userId), isNotNull(consents.bookingId)))
}

/**
 * Booking-scope D-12 step: replace the member identity with an HMAC
 * retention token. Account-scope rows (`booking_id IS NULL`) are erased
 * by the sweep, not this helper. Unwired to any route in 05.1.
 */
export async function pseudonymiseBookingConsents(
  userId: string,
  tx?: Tx
): Promise<void> {
  const token = subjectPseudonymForUser(userId)
  if (tx) {
    await pseudonymiseBookingConsentsInTx(tx, userId, token)
    return
  }
  await withPlatformAdminContext((adminTx) =>
    pseudonymiseBookingConsentsInTx(adminTx, userId, token)
  )
}
