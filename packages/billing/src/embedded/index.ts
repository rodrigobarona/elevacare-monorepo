/**
 * Browser-safe @eleva/billing/embedded entrypoint.
 *
 * Exports React Client Components that mount Stripe Embedded
 * Components inside Eleva. Server-only Stripe SDK calls live in
 * "@eleva/billing/server".
 */

export { ElevaConnectProvider, type ConnectProviderProps } from "./provider"
export {
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectNotificationBanner,
  ConnectBalances,
  ConnectPayouts,
  ConnectPayments,
  ConnectTaxSettings,
  ConnectTaxRegistrations,
} from "./components"
export { elevaConnectAppearance } from "./appearance"
export type { ElevaConnectAppearance } from "./appearance"
