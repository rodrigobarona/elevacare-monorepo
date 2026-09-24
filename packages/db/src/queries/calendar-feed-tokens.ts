import { and, eq, isNull } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import {
  calendarFeedTokens,
  type CalendarFeedToken,
} from "../schema/main/index"

export async function getActiveCalendarFeedToken(
  orgId: string,
  expertProfileId: string
): Promise<CalendarFeedToken | null> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(calendarFeedTokens)
      .where(
        and(
          eq(calendarFeedTokens.orgId, orgId),
          eq(calendarFeedTokens.expertProfileId, expertProfileId),
          isNull(calendarFeedTokens.revokedAt)
        )
      )
      .limit(1)
    return row ?? null
  })
}

/**
 * Revoke every active feed token for the expert, then insert a new hashed
 * token. Caller must emit audit (`rotated`) and return the raw token once.
 */
export async function rotateCalendarFeedToken(
  orgId: string,
  expertProfileId: string,
  tokenHash: string,
  tx: Tx
): Promise<CalendarFeedToken> {
  await tx
    .update(calendarFeedTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(calendarFeedTokens.orgId, orgId),
        eq(calendarFeedTokens.expertProfileId, expertProfileId),
        isNull(calendarFeedTokens.revokedAt)
      )
    )

  const [row] = await tx
    .insert(calendarFeedTokens)
    .values({
      orgId,
      expertProfileId,
      tokenHash,
    })
    .returning()

  if (!row) {
    throw new Error("failed to insert calendar feed token")
  }
  return row
}

/**
 * Revoke the active feed token for the expert. Returns the revoked row, or
 * null when none was active.
 */
export async function revokeCalendarFeedToken(
  orgId: string,
  expertProfileId: string,
  tx: Tx
): Promise<CalendarFeedToken | null> {
  const [row] = await tx
    .update(calendarFeedTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(calendarFeedTokens.orgId, orgId),
        eq(calendarFeedTokens.expertProfileId, expertProfileId),
        isNull(calendarFeedTokens.revokedAt)
      )
    )
    .returning()
  return row ?? null
}

/**
 * Public feed lookup by sha256 hash. Unknown and revoked hashes both return
 * null so the route can emit an identical 404.
 */
export async function findActiveCalendarFeedTokenByHash(
  tokenHash: string
): Promise<CalendarFeedToken | null> {
  return withPlatformAdminContext(async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(calendarFeedTokens)
      .where(
        and(
          eq(calendarFeedTokens.tokenHash, tokenHash),
          isNull(calendarFeedTokens.revokedAt)
        )
      )
      .limit(1)
    return row ?? null
  })
}
