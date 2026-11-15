import { withAudit } from "@eleva/audit"

/**
 * Records an invitation answer (Phase 11.1c). Joining a clinic gives access
 * to its workspace, so both answers are audited. Called from Better Auth's
 * organization `after*Invitation` hooks, after Better Auth's own write.
 */
export async function recordInvitationResponse(
  input: InvitationResponse
): Promise<void> {
  // The membership is already written (Better Auth's own transaction), so
  // a transient audit failure gets one retry before it is reported.
  try {
    await writeInvitationAudit(input)
  } catch {
    await writeInvitationAudit(input)
  }
}

type InvitationResponse = {
  orgId: string
  userId: string
  invitationId: string
  role: string
  outcome: "accepted" | "rejected"
  memberId?: string
}

async function writeInvitationAudit(input: InvitationResponse): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (_tx, ctx) => {
      if (input.outcome === "accepted" && input.memberId) {
        await ctx.emit({
          entity: "membership",
          action: "created",
          entityId: input.memberId,
          payload: {
            via: "invitation",
            invitationId: input.invitationId,
            role: input.role,
          },
        })
        return
      }
      await ctx.emit({
        entity: "invitation",
        action: input.outcome === "accepted" ? "accepted" : "rejected",
        entityId: input.invitationId,
        payload: { role: input.role },
      })
    }
  )
}
