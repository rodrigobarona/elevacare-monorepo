import { eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main } from "@eleva/db"
import { getAdapter } from "./registry"
import type {
  AdapterStatus,
  InvoicingProviderSlug,
  RotatedAdapterCredentials,
} from "./types"

export async function persistExpertIntegrationCredentials(input: {
  orgId: string
  integrationId: string
  vaultRef: string
  expiresAt: Date | null
  /** Omit to leave stored metadata untouched (status token rotation). */
  metadata?: Record<string, unknown>
  rotated: boolean
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.expertIntegrations)
        .set({
          vaultRef: input.vaultRef,
          expiresAt: input.expiresAt,
          updatedAt: new Date(),
          ...(input.rotated ? { lastRefreshAt: new Date() } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        })
        .where(eq(main.expertIntegrations.id, input.integrationId))
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "updated",
        entityId: input.integrationId,
        payload: {
          rotated: input.rotated,
          documentSeriesPersisted: Boolean(input.metadata?.document_series_id),
        },
      })
    }
  )
}

export function toPublicAdapterStatus(
  result: AdapterStatus & { rotatedCredentials?: RotatedAdapterCredentials }
): AdapterStatus {
  return {
    status: result.status,
    ...(result.message ? { message: result.message } : {}),
    ...(result.retryAt ? { retryAt: result.retryAt } : {}),
  }
}

/**
 * Probe the invoicing adapter and persist rotated vault ciphertext on
 * `expert_integrations`. Persistence stays outside the stateless adapter.
 */
export async function probeExpertInvoicingStatus(input: {
  orgId: string
  provider: InvoicingProviderSlug
  integrationId: string
  vaultRef: string
  metadata?: Record<string, unknown>
}): Promise<AdapterStatus> {
  const adapter = getAdapter(input.provider)
  const metadata = {
    ...(input.metadata ?? {}),
    orgId: input.orgId,
  }
  const result = await adapter.status({
    vaultRef: input.vaultRef,
    metadata,
    orgId: input.orgId,
  })
  if (result.rotatedCredentials) {
    await persistExpertIntegrationCredentials({
      orgId: input.orgId,
      integrationId: input.integrationId,
      vaultRef: result.rotatedCredentials.vaultRef,
      expiresAt: result.rotatedCredentials.expiresAt,
      rotated: true,
    })
  }
  return toPublicAdapterStatus(result)
}
