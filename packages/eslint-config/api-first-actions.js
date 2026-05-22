/**
 * Forbid direct @eleva/db write helpers in frontend Server Actions.
 * Mutations must go through apps/api via @eleva/api-client.
 */

/** @type {import("eslint").Linter.Config[]} */
export const apiFirstActionsConfig = [
  {
    files: ["**/src/**/actions.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@eleva/db",
              importNames: [
                "createEventType",
                "updateEventType",
                "deleteEventType",
                "updateExpertProfile",
                "disconnectIntegration",
                "replaceBusySources",
                "replaceDestinationCalendar",
                "ensureExpertProfileForOrg",
                "ensureExpertProfileForOrgDetailed",
              ],
              message:
                "Server Actions must not write via @eleva/db. Call apps/api through @eleva/api-client instead.",
            },
          ],
        },
      ],
    },
  },
]
