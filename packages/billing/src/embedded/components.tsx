"use client"

/**
 * Eleva-flavored re-exports of @stripe/react-connect-js components.
 *
 * Putting all consumer imports through this barrel keeps the
 * boundary lint clean: app code imports from
 * "@eleva/billing/embedded" and never from
 * "@stripe/react-connect-js" directly.
 *
 * Each component MUST be wrapped in <ElevaConnectProvider> in the
 * page tree above it.
 */

export {
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectNotificationBanner,
  ConnectBalances,
  ConnectPayouts,
  ConnectPayments,
  ConnectTaxSettings,
  ConnectTaxRegistrations,
} from "@stripe/react-connect-js"
