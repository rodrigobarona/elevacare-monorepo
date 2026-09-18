export const CLOSED_GATE_INVOICE_NOTIFICATION_KINDS = {
  "invoice.blocked": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "invoice.blocked",
  },
  "invoice.skipped": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "invoice.skipped",
  },
  "invoice.pending": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "invoice.pending",
  },
} as const

/**
 * Closed union of Lane 1 kinds. `invoice.issued` / `invoice.failed` stay
 * off this object until live FT issuance exists.
 */
export const NOTIFICATION_KINDS = {
  ...CLOSED_GATE_INVOICE_NOTIFICATION_KINDS,
  "booking.confirmed": {
    channels: ["email", "sms", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "booking",
    templateId: "booking.confirmed",
  },
  "booking.reminder_24h": {
    channels: ["email", "sms", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "reminder",
    templateId: "booking.reminder_24h",
  },
  "booking.reminder_1h": {
    channels: ["email", "sms", "in_app"],
    urgency: "urgent",
    scope: "org",
    category: "reminder",
    templateId: "booking.reminder_1h",
  },
  "booking.cancelled": {
    channels: ["email", "sms", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "booking",
    templateId: "booking.cancelled",
  },
  "booking.rescheduled": {
    channels: ["email", "sms", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "booking",
    templateId: "booking.rescheduled",
  },
  "payment.failed": {
    channels: ["email", "sms", "in_app"],
    urgency: "urgent",
    scope: "org",
    category: "payment",
    templateId: "payment.failed",
  },
  "payment.receipt": {
    channels: ["email", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "payment.receipt",
  },
  "payout.paid": {
    channels: ["email", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "payout.paid",
  },
  "payout.approval_required": {
    channels: ["email", "in_app"],
    urgency: "normal",
    scope: "org",
    category: "payment",
    templateId: "payout.approval_required",
  },
  "auth.magic_link": {
    channels: ["email"],
    urgency: "urgent",
    scope: "user",
    category: "system",
    templateId: "auth.magic_link",
  },
  "auth.verify_email": {
    channels: ["email"],
    urgency: "urgent",
    scope: "user",
    category: "system",
    templateId: "auth.verify_email",
  },
  "auth.reset_password": {
    channels: ["email"],
    urgency: "urgent",
    scope: "user",
    category: "system",
    templateId: "auth.reset_password",
  },
  "auth.two_factor_otp": {
    channels: ["email"],
    urgency: "urgent",
    scope: "user",
    category: "system",
    templateId: "auth.two_factor_otp",
  },
  "auth.org_invitation": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "system",
    templateId: "auth.org_invitation",
  },
} as const

export type ClosedGateInvoiceNotificationKind =
  keyof typeof CLOSED_GATE_INVOICE_NOTIFICATION_KINDS

export type NotificationKind = keyof typeof NOTIFICATION_KINDS

export type NotificationKindConfig =
  (typeof NOTIFICATION_KINDS)[NotificationKind]

export const NOTIFICATION_KIND_VALUES = Object.keys(
  NOTIFICATION_KINDS
) as NotificationKind[]

export const USER_SCOPED_NOTIFICATION_KINDS = NOTIFICATION_KIND_VALUES.filter(
  (kind) => NOTIFICATION_KINDS[kind].scope === "user"
)
