import { REVEAL_RESTRICTIONS } from "./boundaries.js"

/**
 * @file What an app other than `apps/api` may take from `@eleva/db`.
 *
 * A frontend takes the read helpers listed in `FRONTEND_DB_READS`, and
 * types. It does not take:
 * - a write helper (`createEventType`, `updateSchedule`): writes go through
 *   `apps/api`, where they are authorized, validated and audited;
 * - a handle on the database (`db`, `auditDb`, `withOrgContext`,
 *   `withPlatformAdminContext`), or the drivers under it (`drizzle-orm`,
 *   `@neondatabase/serverless`): a query written in an app has nothing to
 *   scope it to an organization;
 * - a read helper that is not on the list. Many of the others read as the
 *   platform, by a bare id (`getMemberProfile(userId)`,
 *   `listMemberPayments`): safe behind a route that has checked who asks,
 *   not in a page;
 * - anything from a subpath (`@eleva/db/queries/admin`, `/client`, `/rls`,
 *   `/schema`): those are the raw reads behind `apps/api`. Staff queues, for
 *   one, are read through the API so that each read is recorded.
 *
 * Use after `boundariesConfig`. It sets `no-restricted-syntax` again, with
 * the entries `boundariesConfig` had, because a later setting of a rule
 * replaces an earlier one.
 */

/**
 * The read helpers a frontend may import. Each takes the organization (or
 * the expert within it) it reads for, and is called from a page that has
 * resolved that organization from the session.
 *
 * Adding a name is a decision to review: does the helper scope what it
 * reads to the caller's organization, and is the read one that need not be
 * recorded? If not, read it through `apps/api`.
 * `scripts/check-boundaries.test.mjs` fails on a name here that
 * `@eleva/db` does not export or that no app uses.
 */
export const FRONTEND_DB_READS = [
  "getActiveCalendarFeedToken",
  "getDefaultSchedule",
  "getDestinationCalendar",
  "getEventType",
  "getExpertBookingById",
  "getExpertMember",
  "getExpertProfileForOrg",
  "getLatestPartnerApplication",
  "listAvailabilityRules",
  "listBookingLinksForEventType",
  "listBusySourcesForExpert",
  "listCalendarIntegrations",
  "listDateOverrides",
  "listEventTypeModes",
  "listExpertBookings",
  "listExpertEventTypes",
  "listExpertIntegrations",
  "listExpertMembers",
  "listPracticeLocations",
  "listSchedules",
  // Not a read: turns a row already read into what a page shows.
  "toBookingLinkListItem",
]

const HOW =
  "An app takes from @eleva/db only the read helpers listed in @eleva/eslint-config/frontend-db-reads, and types. For anything else (a write, a database handle, a subpath, a read not on the list) call apps/api through @eleva/api-client, or add the read to the list in a reviewed change."

const DRIVERS =
  "An app does not query the database itself: no drizzle-orm, no database driver. Use a listed @eleva/db read helper or call apps/api (frontend-db-reads lint)."

/** `import("@eleva/db")` and `require("@eleva/db")`, written as text. */
const LOADED_AT_RUN_TIME = [
  "ImportExpression[source.value=/^@eleva\\/db(\\/|$)/]",
  "ImportExpression > TemplateLiteral > TemplateElement[value.raw=/@eleva\\/db/]",
  "CallExpression[callee.name='require'][arguments.0.value=/^@eleva\\/db(\\/|$)/]",
  "CallExpression[callee.name='require'] > TemplateLiteral > TemplateElement[value.raw=/@eleva\\/db/]",
].map((selector) => ({ selector, message: HOW }))

/** @type {import("eslint").Linter.Config[]} */
export const frontendDbReadsConfig = [
  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    rules: {
      // The typescript-eslint rule, for `allowTypeImports`, and so that it
      // sits beside the core `no-restricted-imports` of the boundaries
      // instead of replacing it.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@eleva/db",
              allowImportNames: FRONTEND_DB_READS,
              allowTypeImports: true,
              message: HOW,
            },
          ],
          patterns: [
            {
              regex: "^@eleva/db/",
              allowTypeImports: true,
              message: HOW,
            },
            {
              // The package by its place on disk.
              regex: "(^|/)packages/db(/|$)",
              message: HOW,
            },
            {
              regex: "^(drizzle-orm|@neondatabase/|pg$|postgres$)",
              message: DRIVERS,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...REVEAL_RESTRICTIONS,
        ...LOADED_AT_RUN_TIME,
      ],
    },
  },
]
