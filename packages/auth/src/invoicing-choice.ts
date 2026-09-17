import { eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main } from "@eleva/db"

export type ExpertInvoicingProvider = "toconline" | "moloni" | "manual"

export type ExpertInvoicingSetupStatus =
  | "not_started"
  | "connecting"
  | "connected"
  | "manual_acknowledged"
  | "expired"

/** Become-Partner invoicing step is complete only after Auto connect or Manual ack. */
export function isExpertInvoicingChoiceComplete(
  status: ExpertInvoicingSetupStatus | string | null | undefined
): boolean {
  return status === "connected" || status === "manual_acknowledged"
}

export async function saveExpertInvoicingChoice(input: {
  profileId: string
  orgId: string
  actorUserId: string
  provider: ExpertInvoicingProvider
}): Promise<void> {
  const isManual = input.provider === "manual"

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [current] = await tx
        .select({ metadata: main.expertProfiles.metadata })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, input.profileId))
        .limit(1)
        .for("update")
      if (!current) {
        throw new Error("expert profile not found")
      }
      const metadata: Record<string, unknown> = {
        ...((current.metadata ?? {}) as Record<string, unknown>),
        invoicingProvider: input.provider,
      }
      if (isManual) {
        const completedSteps = metadata.completedSteps
        const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
        if (!steps.includes("invoicing")) steps.push("invoicing")
        metadata.completedSteps = steps
        metadata.manualInvoicingAcknowledgedAt = new Date().toISOString()
      } else {
        delete metadata.manualInvoicingAcknowledgedAt
        if (Array.isArray(metadata.completedSteps)) {
          metadata.completedSteps = metadata.completedSteps.filter(
            (step) => step !== "invoicing"
          )
        }
      }

      const [updated] = await tx
        .update(main.expertProfiles)
        .set({
          invoicingProvider: input.provider,
          invoicingSetupStatus: isManual ? "manual_acknowledged" : "connecting",
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(main.expertProfiles.id, input.profileId))
        .returning({ id: main.expertProfiles.id })
      if (!updated) {
        throw new Error("expert profile not found")
      }
      await ctx.emit({
        entity: "expert_profile",
        action: "updated",
        entityId: input.profileId,
        payload: {
          field: "invoicing",
          provider: input.provider,
          ...(isManual ? { acknowledged: true } : {}),
        },
      })
    }
  )
}
