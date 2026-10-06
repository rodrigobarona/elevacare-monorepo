import { and, eq, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main } from "@eleva/db"

export interface LoadedToconlineToken {
  accessToken: string
  vaultRef: string
  expiresAt: Date | null
  /** True when `vaultRef` is new ciphertext the caller still has to persist. */
  rotated: boolean
}

export type StoredToconlineToken =
  | { fresh: LoadedToconlineToken }
  | { refreshToken: string }

class ReuseStoredToken extends Error {
  constructor(readonly token: LoadedToconlineToken) {
    super("toconline_refresh_reuse_stored")
  }
}

class NoStoredIntegration extends Error {
  constructor() {
    super("toconline_refresh_no_stored_integration")
  }
}

const inFlight = new Map<string, Promise<LoadedToconlineToken>>()

/**
 * TOConline rotates refresh tokens, so two concurrent refreshes with the
 * same token lose one rotation and can invalidate the grant. Refreshes are
 * de-duplicated per org in-process and serialized across instances with a
 * row lock on the integration; the rotated ciphertext is persisted before
 * the lock is released so waiters reuse it instead of refreshing again.
 */
export function refreshToconlineSingleFlight(input: {
  orgId: string
  staleVaultRef: string
  refreshToken: string
  resolveStored: (vaultRef: string) => Promise<StoredToconlineToken>
  refresh: (refreshToken: string) => Promise<LoadedToconlineToken>
}): Promise<LoadedToconlineToken> {
  const pending = inFlight.get(input.orgId)
  if (pending) return pending
  const run = refreshUnderRowLock(input).finally(() => {
    inFlight.delete(input.orgId)
  })
  inFlight.set(input.orgId, run)
  return run
}

async function refreshUnderRowLock(
  input: Parameters<typeof refreshToconlineSingleFlight>[0]
): Promise<LoadedToconlineToken> {
  try {
    return await withAudit(
      { orgId: input.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [row] = await tx
          .select({
            id: main.expertIntegrations.id,
            vaultRef: main.expertIntegrations.vaultRef,
          })
          .from(main.expertIntegrations)
          .where(
            and(
              eq(main.expertIntegrations.orgId, input.orgId),
              eq(main.expertIntegrations.slug, "toconline"),
              isNull(main.expertIntegrations.deletedAt)
            )
          )
          .limit(1)
          .for("update")
        if (!row?.vaultRef) throw new NoStoredIntegration()

        let refreshToken = input.refreshToken
        if (row.vaultRef !== input.staleVaultRef) {
          const stored = await input.resolveStored(row.vaultRef)
          if ("fresh" in stored) throw new ReuseStoredToken(stored.fresh)
          refreshToken = stored.refreshToken
        }

        const refreshed = await input.refresh(refreshToken)
        const now = new Date()
        await tx
          .update(main.expertIntegrations)
          .set({
            vaultRef: refreshed.vaultRef,
            expiresAt: refreshed.expiresAt,
            lastRefreshAt: now,
            updatedAt: now,
          })
          .where(eq(main.expertIntegrations.id, row.id))
        await ctx.emit({
          entity: "expert_integration_credential",
          action: "updated",
          entityId: row.id,
          payload: { rotated: true, documentSeriesPersisted: false },
        })
        return { ...refreshed, rotated: false }
      }
    )
  } catch (err) {
    if (err instanceof ReuseStoredToken) return err.token
    if (err instanceof NoStoredIntegration) {
      return input.refresh(input.refreshToken)
    }
    throw err
  }
}
