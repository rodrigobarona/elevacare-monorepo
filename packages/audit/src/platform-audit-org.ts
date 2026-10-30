import { env } from "@eleva/config/env"

/**
 * Reserved organization id for audit_outbox rows that describe platform-scoped
 * work (user-scoped auth e-mail, guest mail) where notification_deliveries.org_id
 * is NULL. The row is tenant-filtered in the audit DB under this org; payload
 * carries `platformScoped` + `recipientUserId` when needed.
 */
export function getPlatformAuditOrgId(): string | null {
  // `env()` rejects a non-empty value that is not a UUID.
  return env().ELEVA_PLATFORM_AUDIT_ORG_ID || null
}

/** Delivery org when present; otherwise the configured platform audit org. */
export function resolveNotificationAuditOrgId(
  deliveryOrgId: string | null | undefined
): string | null {
  if (deliveryOrgId) return deliveryOrgId
  return getPlatformAuditOrgId()
}
