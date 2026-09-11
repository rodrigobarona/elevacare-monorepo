import { eq } from "drizzle-orm"
import { auth, withPlatformAdminContext } from "@eleva/db"

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
 * account deletion. Not wired to those routes in 05.1.
 */
export async function assertMemberCanBook(userId: string): Promise<void> {
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .select({
        banned: auth.user.banned,
        deletionScheduledAt: auth.user.deletionScheduledAt,
      })
      .from(auth.user)
      .where(eq(auth.user.id, userId))
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
