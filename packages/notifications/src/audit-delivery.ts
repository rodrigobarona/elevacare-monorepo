import {
  resolveNotificationAuditOrgId,
  withAudit,
  withPlatformAudit,
  type AuditCtx,
} from "@eleva/audit"
import type { NotificationChannel } from "./channels"
import { NOTIFICATION_KINDS, type NotificationKind } from "./kinds"

export type NotificationDeliveryAuditAction = "sent" | "failed" | "suppressed"

export async function recordNotificationDeliveryAudit(input: {
  deliveryOrgId: string | null | undefined
  recipientUserId?: string | null
  deliveryId: string
  kind: NotificationKind
  channel: NotificationChannel
  action: NotificationDeliveryAuditAction
  extraPayload?: Record<string, unknown>
}): Promise<void> {
  const auditOrgId = resolveNotificationAuditOrgId(input.deliveryOrgId)
  if (!auditOrgId) return

  const platformScoped = !input.deliveryOrgId
  const payload = {
    kind: input.kind,
    channel: input.channel,
    category: NOTIFICATION_KINDS[input.kind].category,
    ...(platformScoped
      ? {
          platformScoped: true,
          recipientUserId: input.recipientUserId ?? null,
        }
      : {}),
    ...input.extraPayload,
  }

  const run = async (_tx: unknown, ctx: AuditCtx) => {
    await ctx.emit({
      entity: "notification",
      action: input.action,
      entityId: input.deliveryId,
      payload,
    })
  }

  if (platformScoped) {
    await withPlatformAudit({ orgId: auditOrgId, actorUserId: null }, run)
  } else {
    await withAudit({ orgId: auditOrgId, actorUserId: null }, run)
  }
}
