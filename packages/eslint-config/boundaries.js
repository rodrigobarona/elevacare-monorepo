/**
 * @file Eleva boundary rules.
 *
 * Seeded in Sprint 0 with:
 * - max-lines cap on src/proxy.ts (≤50 LOC per implementation-sprints.md)
 * - stub no-restricted-imports entries for vendor SDKs (paths[] grows
 *   per-sprint as owning packages come online)
 *
 * Banned imports, by sprint (activate when the owning package lands):
 * - S1: `@workos-inc/node` outside `@eleva/auth`
 * - S1: `@vercel/flags` / `flags` outside `@eleva/flags`
 * - S1: `@neondatabase/serverless` outside `@eleva/db`
 * - S2: `stripe`, `@stripe/stripe-js`, `@stripe/connect-js`,
 *        `@stripe/react-connect-js`, `@vercel/blob` outside
 *        `@eleva/billing`
 * - S2: `toconline-sdk`, `moloni` outside `@eleva/accounting`
 * - S3: `googleapis` / `@microsoft/microsoft-graph-client` outside `@eleva/calendar`
 * - S3: `@upstash/redis` outside `@eleva/scheduling` / `@eleva/workflows`
 * - S4: `resend`, `react-email` outside `@eleva/notifications` / `apps/email`
 * - S4: `twilio` outside `@eleva/notifications`
 * - S4: `workflow` (Vercel Workflows DevKit) outside `@eleva/workflows`
 * - S5: `@daily-co/daily-js` outside session UI (app zone)
 * - S5: `ai` (Vercel AI SDK) outside `@eleva/ai`
 *
 * Each addition above must also land in docs/eleva-v3/implementation-sprints.md
 * under "Global Rules Applied Every Sprint".
 *
 * Boundaries are enforced via no-restricted-imports per consumer
 * (apps/* eslint.config.js), since ESLint's flat-config currently
 * does not support package-aware allowlists. The approach: app
 * configs ban the SDK imports globally; the owning packages (which
 * have their OWN local eslint configs without boundariesConfig) are
 * the only places those imports compile.
 */

/** @type {import("eslint").Linter.Config[]} */
export const boundariesConfig = [
  {
    files: ["**/src/proxy.ts"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "stripe",
              message:
                "Import Stripe through @eleva/billing/server (boundary lint).",
            },
            {
              name: "@stripe/connect-js",
              message:
                "Use @eleva/billing/embedded.ElevaConnectProvider (boundary lint).",
            },
            {
              name: "@stripe/react-connect-js",
              message:
                "Use re-exports from @eleva/billing/embedded (boundary lint).",
            },
            {
              name: "@stripe/stripe-js",
              message:
                "Stripe.js access goes through @eleva/billing/embedded (boundary lint).",
            },
            {
              name: "@vercel/blob",
              message: "Use @eleva/billing/uploads helpers (boundary lint).",
            },
            {
              name: "@vercel/blob/client",
              message:
                "Use @eleva/billing/uploads-client (browser) or @eleva/billing/uploads-handler (route handler) (boundary lint).",
            },
          ],
          patterns: [
            // Sprint 2: per-adapter SDKs land in @eleva/accounting.
            // No standalone npm packages today (TOConline + Moloni use
            // raw fetch); patterns ready when a community SDK appears.
          ],
        },
      ],
    },
  },
]
