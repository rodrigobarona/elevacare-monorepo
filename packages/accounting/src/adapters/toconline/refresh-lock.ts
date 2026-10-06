import { and, eq, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext } from "@eleva/db"

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

type RefreshInput = {
  orgId: string
  staleVaultRef: string
  refreshToken: string
  resolveStored: (vaultRef: string) => Promise<StoredToconlineToken>
  refresh: (refreshToken: string) => Promise<LoadedToconlineToken>
}

class LostRotationRace extends Error {
  constructor() {
    super("toconline_refresh_lost_race")
  }
}

const inFlight = new Map<string, Promise<LoadedToconlineToken>>()

/**
 * TOConline rotates refresh tokens, so two concurrent refreshes with the
 * same token lose one rotation and can invalidate the grant. Refreshes are
 * de-duplicated per org in-process; across instances the vendor call runs
 * outside any transaction and the result is persisted with a
 * compare-and-set on the stale ciphertext, so a loser adopts the winner's
 * token instead of overwriting it.
 */
export function refreshToconlineSingleFlight(
  input: RefreshInput
): Promise<LoadedToconlineToken> {
  const pending = inFlight.get(input.orgId)
  if (pending) return pending
  const run = refreshWithCompareAndSet(input).finally(() => {
    inFlight.delete(input.orgId)
  })
  inFlight.set(input.orgId, run)
  return run
}

async function refreshWithCompareAndSet(
  input: RefreshInput
): Promise<LoadedToconlineToken> {
  const row = await loadIntegrationRow(input.orgId)
  if (!row?.vaultRef) return input.refresh(input.refreshToken)

  let expectedVaultRef = input.staleVaultRef
  let refreshToken = input.refreshToken
  if (row.vaultRef !== expectedVaultRef) {
    const stored = await input.resolveStored(row.vaultRef)
    if ("fresh" in stored) return stored.fresh
    expectedVaultRef = row.vaultRef
    refreshToken = stored.refreshToken
  }

  let refreshed: LoadedToconlineToken
  try {
    refreshed = await input.refresh(refreshToken)
  } catch (err) {
    const winner = await freshStoredToken(input, expectedVaultRef)
    if (winner) return winner
    throw err
  }

  try {
    return await persistRotation(
      input.orgId,
      row.id,
      expectedVaultRef,
      refreshed
    )
  } catch (err) {
    if (err instanceof LostRotationRace) {
      return (await freshStoredToken(input, expectedVaultRef)) ?? refreshed
    }
    // The provider already rotated the grant; hand the new ciphertext back
    // so the caller's own persistence retries instead of losing it.
    return refreshed
  }
}

async function loadIntegrationRow(orgId: string) {
  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: main.expertIntegrations.id,
        vaultRef: main.expertIntegrations.vaultRef,
      })
      .from(main.expertIntegrations)
      .where(
        and(
          eq(main.expertIntegrations.orgId, orgId),
          eq(main.expertIntegrations.slug, "toconline"),
          isNull(main.expertIntegrations.deletedAt)
        )
      )
      .limit(1)
    return row ?? null
  })
}

async function freshStoredToken(
  input: RefreshInput,
  expectedVaultRef: string
): Promise<LoadedToconlineToken | null> {
  const row = await loadIntegrationRow(input.orgId)
  if (!row?.vaultRef || row.vaultRef === expectedVaultRef) return null
  const stored = await input.resolveStored(row.vaultRef)
  return "fresh" in stored ? stored.fresh : null
}

async function persistRotation(
  orgId: string,
  integrationId: string,
  expectedVaultRef: string,
  refreshed: LoadedToconlineToken
): Promise<LoadedToconlineToken> {
  return withAudit({ orgId, actorUserId: null }, async (tx, ctx) => {
    const now = new Date()
    const [updated] = await tx
      .update(main.expertIntegrations)
      .set({
        vaultRef: refreshed.vaultRef,
        expiresAt: refreshed.expiresAt,
        lastRefreshAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(main.expertIntegrations.id, integrationId),
          eq(main.expertIntegrations.vaultRef, expectedVaultRef)
        )
      )
      .returning({ id: main.expertIntegrations.id })
    if (!updated) throw new LostRotationRace()
    await ctx.emit({
      entity: "expert_integration_credential",
      action: "updated",
      entityId: integrationId,
      payload: { rotated: true, documentSeriesPersisted: false },
    })
    return { ...refreshed, rotated: false }
  })
}
