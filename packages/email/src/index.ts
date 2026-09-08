export {
  renderBookingConfirmed,
  renderBookingRescheduled,
  renderBookingCancelled,
} from "./render"
export { sendAuthEmail, type AuthEmailKind } from "./send-auth"
export type { BookingConfirmedProps } from "./templates"
export type { BookingRescheduledProps } from "./templates"
export type { BookingCancelledProps } from "./templates"
export type { EmailLocale } from "./i18n"
export { getEmailTranslations } from "./i18n"
