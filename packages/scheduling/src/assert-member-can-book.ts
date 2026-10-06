import { eq, sql } from "drizzle-orm"
import { withPlatformAdminContext } from "@eleva/db/context"
import { user } from "@eleva/db/schema/auth"

export type MemberBookabilityError =
  | "ACCOUNT_DELETION_SCHEDULED"
  | "ACCOUNT_BANNED"
  | "GUEST_EMAIL_BLOCKED"

export class BookingError extends Error {
  readonly code: MemberBookabilityError

  constructor(code: MemberBookabilityError) {
    super(code)
    this.name = "BookingError"
    this.code = code
  }
}

/**
 * Blocks reserve/intent when the member is banned or has a pending
 * account deletion. Guests without a user id use
 * `assertGuestEmailCanBook`. Never used by POST /bookings/confirm.
 */
export async function assertMemberCanBook(userId: string): Promise<void> {
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .select({
        banned: user.banned,
        deletionScheduledAt: user.deletionScheduledAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
  )
  const member = rows[0]
  if (!member || member.banned) {
    throw new BookingError("ACCOUNT_BANNED")
  }
  if (member.deletionScheduledAt) {
    throw new BookingError("ACCOUNT_DELETION_SCHEDULED")
  }
}

/**
 * Guest checkout with the email of a banned or deletion-pending member is
 * blocked too. Unknown emails pass. Both blocked states share one opaque
 * code so the endpoint does not reveal which state the account is in.
 */
export async function assertGuestEmailCanBook(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .select({
        banned: user.banned,
        deletionScheduledAt: user.deletionScheduledAt,
      })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalized}`)
      .limit(1)
  )
  const member = rows[0]
  if (member && (member.banned || member.deletionScheduledAt)) {
    throw new BookingError("GUEST_EMAIL_BLOCKED")
  }
}
