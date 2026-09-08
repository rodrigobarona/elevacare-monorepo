import { config } from "@eleva/eslint-config/base"

export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@workos-inc", "@workos-inc/*"],
              message:
                "Leftover identity-provider SDKs are removed. Use Better Auth.",
            },
          ],
        },
      ],
    },
  },
]
