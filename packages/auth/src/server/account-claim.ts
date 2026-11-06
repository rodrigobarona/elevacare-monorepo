import { eq, or } from "drizzle-orm"
import { getSessionFromCtx } from "better-auth/api"
import { withAudit } from "@eleva/audit"
import { auth, db } from "@eleva/db"
import { findDefaultOrganizationId } from "../provision-personal-space"

type AuthEndpointContext = Parameters<typeof getSessionFromCtx>[0]

export const ACCOUNT_NOT_LINKED = "account_not_linked"

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

/**
 * `user.validateUserInfo` gate (SEC2-01/02). A same-email provider sign-in
 * may not attach a new identity to a verified account: only the signed-in
 * owner can link (Settings → Connect Google). Unverified rows stay
 * claimable by the provider's proof of email; see `purgeBeforeClaim`.
 */
export async function guardAccountLink(
  data: {
    user: { id?: unknown }
    source: { action: string; method: string }
  },
  ctx: AuthEndpointContext
): Promise<{ error: string; errorDescription: string } | undefined> {
  if (data.source.action !== "link-account") return
  const userId = typeof data.user.id === "string" ? data.user.id : null
  if (!userId) return
  const user = await findUser(ctx, userId)
  if (!user?.emailVerified) return
  const ownerSignedIn = await signedInUserId(ctx)
    .then((id) => id === userId)
    .catch(() => false)
  if (ownerSignedIn) return
  return {
    error: ACCOUNT_NOT_LINKED,
    errorDescription:
      "Sign in to your existing account first, then connect this provider in Settings.",
  }
}

async function enrolledCredentials(userId: string) {
  const [accounts, passkeys, factors, apiKeys] = await Promise.all([
    db()
      .select({ id: auth.account.id, providerId: auth.account.providerId })
      .from(auth.account)
      .where(eq(auth.account.userId, userId)),
    db()
      .select({ id: auth.passkey.id })
      .from(auth.passkey)
      .where(eq(auth.passkey.userId, userId)),
    db()
      .select({ id: auth.twoFactor.id })
      .from(auth.twoFactor)
      .where(eq(auth.twoFactor.userId, userId)),
    db()
      .select({ id: auth.apikey.id })
      .from(auth.apikey)
      .where(
        or(eq(auth.apikey.userId, userId), eq(auth.apikey.referenceId, userId))
      ),
  ])
  return { accounts, passkeys, factors, apiKeys }
}

class ClaimRaced extends Error {}

/**
 * `databaseHooks.account.create.before`. When a provider claims an
 * unverified row without the owner signed in, everything enrolled before
 * verification is treated as attacker-controlled: other logins (password,
 * Google, Microsoft), passkeys, two-factor secrets and backup codes, API
 * keys and sessions are removed before the new identity is attached.
 * Throws (aborting the link) if the owner check or the audited purge fails.
 * A row verified in the meantime is left untouched.
 */
export async function purgeBeforeClaim(
  account: { userId: string; providerId: string },
  ctx: AuthEndpointContext | null
): Promise<void> {
  if (!ctx || account.providerId === "credential") return
  const user = await findUser(ctx, account.userId)
  if (!user || user.emailVerified) return
  if ((await signedInUserId(ctx)) === user.id) return

  const found = await enrolledCredentials(user.id)
  const total =
    found.accounts.length +
    found.passkeys.length +
    found.factors.length +
    found.apiKeys.length
  if (total > 0) {
    const orgId = await findDefaultOrganizationId(user.id)
    if (!orgId) {
      throw new Error("account claim: no organization to audit the purge")
    }
    const purged = await withAudit(
      { orgId, actorUserId: user.id },
      async (tx, audit) => {
        const [current] = await tx
          .select({ emailVerified: auth.user.emailVerified })
          .from(auth.user)
          .where(eq(auth.user.id, user.id))
          .for("update")
        if (!current || current.emailVerified) throw new ClaimRaced()
        await tx.delete(auth.account).where(eq(auth.account.userId, user.id))
        await tx.delete(auth.passkey).where(eq(auth.passkey.userId, user.id))
        await tx
          .delete(auth.twoFactor)
          .where(eq(auth.twoFactor.userId, user.id))
        await tx
          .delete(auth.apikey)
          .where(
            or(
              eq(auth.apikey.userId, user.id),
              eq(auth.apikey.referenceId, user.id)
            )
          )
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
            removedLogins: found.accounts.map((row) => row.providerId),
            removedPasskeys: found.passkeys.length,
            removedTwoFactor: found.factors.length,
            removedApiKeys: found.apiKeys.length,
          },
        })
        return true
      }
    ).catch((error: unknown) => {
      if (error instanceof ClaimRaced) return false
      throw error
    })
    if (!purged) return
  }
  // Runs again on the next claim attempt if it fails here: the purge above
  // then finds nothing and only the session revocation repeats.
  await ctx.context.internalAdapter.deleteUserSessions(user.id)
}
