export {
  renderAuthEmail,
  renderBookingConfirmed,
  renderBookingRescheduled,
  renderBookingCancelled,
  renderBookingReminder,
  renderInvoiceClosedGate,
  renderClinicDecision,
  renderPartnerDecision,
  renderPaymentPayoutNotice,
  type AuthEmailContent,
} from "./render"
export type {
  AuthEmailKind,
  AuthTransactionalProps,
} from "./components/auth-transactional"
export type { SessionPlace } from "./components/session-access"
export type { BookingConfirmedProps } from "./templates"
export type { BookingRescheduledProps } from "./templates"
export type { BookingCancelledProps } from "./templates"
export type { BookingReminderProps, BookingReminderWindow } from "./templates"
export type {
  InvoiceClosedGateProps,
  InvoiceClosedGateStatus,
} from "./templates"
export type {
  PaymentPayoutNoticeProps,
  PaymentPayoutNoticeKind,
} from "./templates"
export { partnerDecisionCopy } from "./templates"
export type { PartnerDecisionKind, PartnerDecisionProps } from "./templates"
export { clinicDecisionCopy } from "./templates"
export { emailSafeName } from "./safe-name"
export type { ClinicDecisionKind, ClinicDecisionProps } from "./templates"
export type { EmailLocale } from "./i18n"
export { getEmailTranslations } from "./i18n"
