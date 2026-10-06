import { and, eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { getAdapter } from "./registry"
import { InvoicingProviderSlug } from "./types"

export type DisconnectExpertInvoicingResult = {
  disconnected: boolean
  provider: InvoicingProviderSlug | null
}

/**
 * Disconnect the expert's invoicing provider. Deleting the
 * `expert_integrations` row shreds the envelope ciphertext (tokens are
 * never stored elsewhere) and the profile returns to `not_started`, so the
 * expert must choose a provider or manual invoicing again. Already issued
 * documents and invoice rows are untouched. Returns null without a profile.
 */
export async function disconnectExpertInvoicing(input: {
  userId: string
}): Promise<DisconnectExpertInvoicingResult | null> {
  const profile = await withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        id: main.expertProfiles.id,
        orgId: main.expertProfiles.orgId,
        invoicingProvider: main.expertProfiles.invoicingProvider,
      })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.userId, input.userId))
      .limit(1)
    return row ?? null
  })
  if (!profile) return null

  const provider = parseProvider(profile.invoicingProvider)
  if (!provider) return { disconnected: false, provider: null }

  const removed = await withAudit(
    { orgId: profile.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const deleted = await tx
        .delete(main.expertIntegrations)
        .where(
          and(
            eq(main.expertIntegrations.expertProfileId, profile.id),
            eq(main.expertIntegrations.category, "invoicing")
          )
        )
        .returning({
          id: main.expertIntegrations.id,
          slug: main.expertIntegrations.slug,
          vaultRef: main.expertIntegrations.vaultRef,
        })

      const [current] = await tx
        .select({ metadata: main.expertProfiles.metadata })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, profile.id))
        .limit(1)
        .for("update")
      const { invoicingProvider: _dropped, ...metadata } = (current?.metadata ??
        {}) as Record<string, unknown>

      await tx
        .update(main.expertProfiles)
        .set({
          invoicingProvider: null,
          invoicingSetupStatus: "not_started",
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(main.expertProfiles.id, profile.id))

      await ctx.emit({
        entity: "expert_integration_credential",
        action: "disconnected",
        entityId: deleted[0]?.id ?? profile.id,
        payload: {
          provider,
          category: "invoicing",
          credentialsDeleted: deleted.length,
        },
      })
      return deleted
    }
  )

  for (const row of removed) {
    const slug = parseProvider(row.slug)
    if (!slug || !row.vaultRef) continue
    try {
      await getAdapter(slug).disconnect({ vaultRef: row.vaultRef })
    } catch (err) {
      console.error("[accounting/disconnect] provider revoke failed", {
        provider: slug,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { disconnected: true, provider }
}

function parseProvider(value: string | null): InvoicingProviderSlug | null {
  const parsed = InvoicingProviderSlug.safeParse(value)
  return parsed.success ? parsed.data : null
}
