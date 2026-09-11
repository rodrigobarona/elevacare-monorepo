import { eq } from "drizzle-orm"
import { withPlatformAdminContext } from "@eleva/db/context"
import { user } from "@eleva/db/schema/auth"

export type MemberBookabilityError =
  | "ACCOUNT_DELETION_SCHEDULED"
  | "ACCOUNT_BANNED"

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
 * account deletion. Guests without a user id skip this check. Never
 * used by POST /bookings/confirm.
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
