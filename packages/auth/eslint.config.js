import { baseImportBansWithout, config } from "@eleva/eslint-config/base"

/** This package wraps Better Auth, so it keeps every base ban except that one. */
export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": baseImportBansWithout((module) =>
        /^@?better-auth(\/|$)/.test(module)
      ),
    },
  },
]
