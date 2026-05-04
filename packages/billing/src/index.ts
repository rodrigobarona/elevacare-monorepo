/**
 * @eleva/billing
 *
 * Owns ALL Stripe SDK access for the platform. Other packages must
 * NEVER import from `stripe`, `@stripe/connect-js`, or
 * `@stripe/react-connect-js` directly — boundary lint enforces.
 *
 * Sub-entrypoints:
 *   - "@eleva/billing/server"   — server-only (Stripe SDK, AccountSession)
 *   - "@eleva/billing/embedded" — client React wrappers for Connect
 *   - "@eleva/billing/uploads"  — Vercel Blob helper for application docs
 */

export type {
  ConnectAccountSession,
  CreateConnectAccountInput,
  CreateAccountSessionInput,
  IdentityVerificationSession,
} from "./server/types"
