/**
 * @file Eleva boundary rules.
 *
 * Seeded in Sprint 0 with:
 * - max-lines cap on src/proxy.ts (≤50 LOC per implementation-sprints.md)
 * - stub no-restricted-imports entries for vendor SDKs (paths[] grows
 *   per-sprint as owning packages come online)
 *
 * Banned imports, by sprint (activate when the owning package lands):
 * - leftover IDP SDKs (`@workos-inc/*`) nowhere
 * - `better-auth` only inside `@eleva/auth`
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
 * - S5: `ai` / `@ai-sdk/*` (Vercel AI SDK) outside `@eleva/ai`
 * - Phase 4B: `platejs`, `@platejs/*`, `slate*`, `@radix-ui/*` outside
 *   `@eleva/editor` (ADR-023). Owning package omits `boundariesConfig`
 *   from its local eslint.config.js (same pattern as `@eleva/billing`).
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
              message: "Use @eleva/storage helpers (boundary lint).",
            },
            {
              name: "@vercel/blob/client",
              message:
                "Use @eleva/storage/blob-upload-client (browser) or @eleva/storage/blob-upload-handler (route handler) (boundary lint).",
            },
            {
              name: "twilio",
              message:
                "Import Twilio only through @eleva/notifications (boundary lint).",
            },
            {
              name: "resend",
              message:
                "Import Resend only through @eleva/notifications (boundary lint).",
            },
            {
              name: "platejs",
              message:
                "Import Plate only through @eleva/editor (ADR-023 boundary lint).",
            },
            {
              name: "ai",
              message:
                "Import the Vercel AI SDK only through @eleva/ai (boundary lint).",
            },
          ],
          patterns: [
            {
              group: ["better-auth", "better-auth/*", "@better-auth/*"],
              message:
                "Import Better Auth only through @eleva/auth (boundary lint).",
            },
            {
              group: ["@workos-inc", "@workos-inc/**"],
              message:
                "Leftover identity-provider SDKs are removed. Use @eleva/auth.",
            },
            {
              group: ["platejs/*", "platejs/**"],
              message:
                "Import Plate only through @eleva/editor (ADR-023 boundary lint).",
            },
            {
              group: ["@platejs", "@platejs/**"],
              message:
                "Import @platejs/* only through @eleva/editor (ADR-023 boundary lint).",
            },
            {
              group: ["slate", "slate-*", "@udecode/slate", "@udecode/slate-*"],
              message:
                "Import slate* only through @eleva/editor (ADR-023 boundary lint).",
            },
            {
              group: ["@radix-ui", "@radix-ui/**"],
              message:
                "Radix is banned outside packages/editor (ADR-022 / ADR-023 exception).",
            },
            {
              group: ["@ai-sdk", "@ai-sdk/**", "ai/*", "ai/**"],
              message:
                "Import AI SDK providers only through @eleva/ai (boundary lint).",
            },
            // Sprint 2: per-adapter SDKs land in @eleva/accounting.
            // No standalone npm packages today (TOConline + Moloni use
            // raw fetch); patterns ready when a community SDK appears.
          ],
        },
      ],
    },
  },
]
