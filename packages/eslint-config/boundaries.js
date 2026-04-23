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
 * - S2: `stripe`, `@stripe/stripe-js`, `@stripe/connect-js` outside `@eleva/billing`
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
 */

/** @type {import("eslint").Linter.Config[]} */
export const boundariesConfig = [
  {
    files: ['**/src/proxy.ts'],
    rules: {
      'max-lines': [
        'error',
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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            // Sprint 0: empty. Package ownership is declared as packages land.
          ],
          patterns: [
            // Sprint 0: empty. Populate per sprint.
          ],
        },
      ],
    },
  },
];
