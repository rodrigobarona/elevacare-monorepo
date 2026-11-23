import { config } from "@eleva/eslint-config/base"

/** This package wraps Better Auth, so it keeps every base ban except that one. */
export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@workos-inc", "@workos-inc/**"],
              message:
                "Leftover identity-provider SDKs are removed. Use Better Auth.",
            },
            {
              group: [
                "lucide-react",
                "lucide-react/**",
                "@phosphor-icons/react",
                "@phosphor-icons/react/**",
              ],
              message:
                "Import icons from @eleva/icons (or @eleva/icons/client); only packages/icons wraps the vendor set.",
            },
          ],
        },
      ],
    },
  },
]
