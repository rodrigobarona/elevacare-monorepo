export {
  renderAuthEmail,
  renderBookingConfirmed,
  renderBookingRescheduled,
  renderBookingCancelled,
  renderInvoiceClosedGate,
  type AuthEmailContent,
} from "./render"
export type {
  AuthEmailKind,
  AuthTransactionalProps,
} from "./components/auth-transactional"
export type { BookingConfirmedProps } from "./templates"
export type { BookingRescheduledProps } from "./templates"
export type { BookingCancelledProps } from "./templates"
export type {
  InvoiceClosedGateProps,
  InvoiceClosedGateStatus,
} from "./templates"
export type { EmailLocale } from "./i18n"
export { getEmailTranslations } from "./i18n"
