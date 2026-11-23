import { REVEAL_RESTRICTION } from "./boundaries.js"

/**
 * @file What an app other than `apps/api` may take from `@eleva/db`.
 *
 * A frontend reads through a named read helper (`getExpertProfileForOrg`,
 * `listSchedules`) and takes types. It does not take:
 * - a write helper (`createEventType`, `updateSchedule`): writes go through
 *   `apps/api`, where they are authorized, validated and audited;
 * - a handle on the database (`db`, `auditDb`, `withOrgContext`,
 *   `withPlatformAdminContext`): a query written in an app has no helper to
 *   scope it to an organization;
 * - anything from a subpath (`@eleva/db/queries/admin`, `/client`, `/rls`,
 *   `/schema`): those are the raw reads behind `apps/api`. Staff queues, for
 *   one, are read through the API so that each read is recorded.
 *
 * A read helper is known by its name. `DB_READ_NAME` is the whole rule: to
 * let a frontend use a helper named another way, rename the helper or add
 * its prefix here, on purpose.
 *
 * Use after `boundariesConfig`. It sets `no-restricted-syntax` again, with
 * the entry `boundariesConfig` had, because a later setting of a rule
 * replaces an earlier one.
 */

/** A read helper: `get…`, `list…`, `count…`, and the few mappers and tests. */
export const DB_READ_NAME =
  "^(?!.*(OrCreate|OrInsert|ForUpdate))(get|list|count|find|load|to|is|has)[A-Z]"

const HOW =
  "An app reads from @eleva/db by named read helper (get…, list…, count…) and takes types. Writes, database handles and @eleva/db subpaths belong to apps/api and the domain packages: call the API through @eleva/api-client (frontend-db-reads lint)."

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
          patterns: [
            {
              regex: "^@eleva/db$",
              allowImportNamePattern: DB_READ_NAME,
              allowTypeImports: true,
              message: HOW,
            },
            {
              regex: "^@eleva/db/",
              allowTypeImports: true,
              message: HOW,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        REVEAL_RESTRICTION,
        {
          // `await import("@eleva/db")` gets past the import rule.
          selector: "ImportExpression[source.value=/^@eleva\\/db(\\/|$)/]",
          message: HOW,
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/^@eleva\\/db(\\/|$)/]",
          message: HOW,
        },
      ],
    },
  },
]
