import { eq, or } from "drizzle-orm"
import { getSessionFromCtx } from "better-auth/api"
import { getPlatformAuditOrgId, withAudit } from "@eleva/audit"
import { auth } from "@eleva/db"
import { findDefaultOrganizationId } from "../provision-personal-space"

type AuthEndpointContext = Parameters<typeof getSessionFromCtx>[0]

export const ACCOUNT_NOT_LINKED = "account_not_linked"

/**
 * Unsigned claims the guard approved on an unverified row, keyed by user id.
 * The account-create hook consumes the entry in the same request; a row that
 * turns verified between the two steps then aborts the link instead of
 * attaching the provider without the owner. Entries expire so a link that
 * fails before the hook cannot leave one behind.
 */
const PENDING_CLAIM_TTL_MS = 60_000
const pendingClaims = new Map<string, number>()

function recordPendingClaim(userId: string): void {
  const now = Date.now()
  for (const [id, expiresAt] of pendingClaims) {
    if (expiresAt <= now) pendingClaims.delete(id)
  }
  pendingClaims.set(userId, now + PENDING_CLAIM_TTL_MS)
}

function takePendingClaim(userId: string): boolean {
  const expiresAt = pendingClaims.get(userId)
  pendingClaims.delete(userId)
  return expiresAt !== undefined && expiresAt > Date.now()
}

/** `null` when signed out. A failed lookup rethrows so callers fail closed. */
async function signedInUserId(
  ctx: AuthEndpointContext
): Promise<string | null> {
  const session = await getSessionFromCtx(ctx)
  return session?.user.id ?? null
}

async function findUser(
  ctx: AuthEndpointContext,
  userId: string
): Promise<{ id: string; emailVerified: boolean } | null> {
  const user = await ctx.context.internalAdapter.findUserById(userId)
  return user
    ? { id: user.id, emailVerified: Boolean(user.emailVerified) }
    : null
}

const NOT_LINKED = {
  error: ACCOUNT_NOT_LINKED,
  errorDescription:
    "Sign in to your existing account first, then connect this provider in Settings.",
}

/**
 * `user.validateUserInfo` gate (SEC2-01/02). A provider sign-in may not
 * attach a new identity to an existing account unless the owner is signed
 * in (Settings → Connect Google). The one exception is an unverified row
 * whose email the provider itself has verified: that proof of email claims
 * the row, and `purgeBeforeClaim` wipes what was enrolled before it.
 */
export async function guardAccountLink(
  data: {
    user: { id?: unknown; emailVerified?: unknown }
    source: { action: string; method: string }
  },
  ctx: AuthEndpointContext
): Promise<{ error: string; errorDescription: string } | undefined> {
  if (data.source.action !== "link-account") return
  const userId = typeof data.user.id === "string" ? data.user.id : null
  if (!userId) return
  const user = await findUser(ctx, userId)
  if (!user) return
  const ownerSignedIn = await signedInUserId(ctx)
    .then((id) => id === userId)
    .catch(() => false)
  if (ownerSignedIn) return
  if (user.emailVerified || data.user.emailVerified !== true) return NOT_LINKED
  recordPendingClaim(userId)
  return
}

class ClaimRaced extends Error {}

/**
 * `databaseHooks.account.create.before`. When a provider claims an
 * unverified row without the owner signed in, everything enrolled before
 * verification is treated as attacker-controlled. Sessions are revoked,
 * then other logins (password, Google, Microsoft), passkeys, two-factor
 * secrets and backup codes and API keys are removed in one audited write
 * (`user.claimed`, always emitted), then sessions are revoked again so
 * nothing enrolled from a session opened in between survives. Throws, which
 * aborts the link, if the owner check or the audited purge fails, or if the
 * row became verified while the claim was in flight.
 */
export async function purgeBeforeClaim(
  account: { userId: string; providerId: string },
  ctx: AuthEndpointContext | null
): Promise<void> {
  if (!ctx || account.providerId === "credential") return
  const claimApproved = takePendingClaim(account.userId)
  const user = await findUser(ctx, account.userId)
  if (!user) return
  if ((await signedInUserId(ctx)) === user.id) return
  if (user.emailVerified) {
    // A brand-new user or an unrelated create; only a claim the guard
    // approved on an unverified row can race verification.
    if (claimApproved) throw new ClaimRaced("account claim raced verification")
    return
  }

  const orgId =
    (await findDefaultOrganizationId(user.id)) ?? getPlatformAuditOrgId()
  if (!orgId) {
    throw new Error("account claim: no organization to audit the purge")
  }

  // Revoke first: passkey, two-factor and password changes need a live
  // session checked against storage, not the cookie cache.
  await ctx.context.internalAdapter.deleteUserSessions(user.id)
  await withAudit({ orgId, actorUserId: user.id }, async (tx, audit) => {
    const [current] = await tx
      .select({ emailVerified: auth.user.emailVerified })
      .from(auth.user)
      .where(eq(auth.user.id, user.id))
      .for("update")
    if (!current || current.emailVerified) {
      throw new ClaimRaced("account claim raced verification")
    }
    const logins = await tx
      .delete(auth.account)
      .where(eq(auth.account.userId, user.id))
      .returning({ providerId: auth.account.providerId })
    const passkeys = await tx
      .delete(auth.passkey)
      .where(eq(auth.passkey.userId, user.id))
      .returning({ id: auth.passkey.id })
    const factors = await tx
      .delete(auth.twoFactor)
      .where(eq(auth.twoFactor.userId, user.id))
      .returning({ id: auth.twoFactor.id })
    const apiKeys = await tx
      .delete(auth.apikey)
      .where(
        or(
          eq(auth.apikey.userId, user.id),
          eq(auth.apikey.referenceId, user.id)
        )
      )
      .returning({ id: auth.apikey.id })
    await tx
      .update(auth.user)
      .set({ twoFactorEnabled: false })
      .where(eq(auth.user.id, user.id))
    await audit.emit({
      entity: "user",
      action: "claimed",
      entityId: user.id,
      payload: {
        providerId: account.providerId,
        removedLogins: logins.map((row) => row.providerId),
        removedPasskeys: passkeys.length,
        removedTwoFactor: factors.length,
        removedApiKeys: apiKeys.length,
        sessionsRevoked: true,
      },
    })
  })
  await ctx.context.internalAdapter.deleteUserSessions(user.id)
}
