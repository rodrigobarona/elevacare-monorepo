export const CLOSED_GATE_INVOICE_NOTIFICATION_KINDS = {
  "invoice.blocked": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
  },
  "invoice.skipped": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
  },
  "invoice.pending": {
    channels: ["email"],
    urgency: "normal",
    scope: "org",
    category: "payment",
  },
} as const

export type ClosedGateInvoiceNotificationKind =
  keyof typeof CLOSED_GATE_INVOICE_NOTIFICATION_KINDS
