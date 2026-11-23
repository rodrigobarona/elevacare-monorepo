import { BOUNDARY_SYNTAX, namedAsText } from "./boundaries.js"

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
 * the entries `boundariesConfig` had (`BOUNDARY_SYNTAX`), because a later
 * setting of a rule replaces an earlier one.
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
export const FRONTEND_DB_READS = Object.freeze([
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
])

const HOW =
  "An app takes from @eleva/db only the read helpers listed in @eleva/eslint-config/frontend-db-reads, and types. For anything else (a write, a database handle, a subpath, a read not on the list) call apps/api through @eleva/api-client, or add the read to the list in a reviewed change."

const DRIVERS =
  "An app does not query the database itself: no drizzle-orm, no database driver. Use a listed @eleva/db read helper or call apps/api (frontend-db-reads lint)."

/**
 * The database package, or what is under it, named as text where it can
 * be loaded from (`namedAsText`). A path into `packages/db` is refused by
 * the boundaries, like any path into a workspace.
 */
const DATABASE_TEXT =
  "/^@eleva\\/db([\\/?#]|$)|^drizzle-orm(\\/|$)|^@neondatabase\\//"
const LOADED_AT_RUN_TIME = namedAsText(DATABASE_TEXT, HOW)

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
              // A subpath, or the name with something after it that a
              // bundler would drop (`@eleva/db?raw`).
              regex: "^@eleva/db[/?#]",
              allowTypeImports: true,
              message: HOW,
            },
            {
              regex: "^(drizzle-orm|pg|postgres)(/|$)|^@neondatabase/",
              message: DRIVERS,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...BOUNDARY_SYNTAX,
        ...LOADED_AT_RUN_TIME,
      ],
    },
  },
]
