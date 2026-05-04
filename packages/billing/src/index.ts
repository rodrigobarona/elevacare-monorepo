/**
 * @eleva/billing
 *
 * Owns ALL Stripe SDK access for the platform. Other packages must
 * NEVER import from `stripe`, `@stripe/connect-js`, or
 * `@stripe/react-connect-js` directly — boundary lint enforces.
 *
 * Sub-entrypoints:
 *   - "@eleva/billing/server"          — server-only (Stripe SDK, AccountSession)
 *   - "@eleva/billing/embedded"        — client React wrappers for Connect
 *   - "@eleva/billing/uploads"         — Vercel Blob server `put`/`del` helpers
 *   - "@eleva/billing/uploads-handler" — server-side `handleUpload` wrapper
 *                                        for client-driven uploads (Route Handler)
 *   - "@eleva/billing/uploads-client"  — `"use client"` re-export of `upload()`
 */

export type {
  ConnectAccountSession,
  CreateConnectAccountInput,
  CreateAccountSessionInput,
  IdentityVerificationSession,
} from "./server/types"
