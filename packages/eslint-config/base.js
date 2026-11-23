import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import onlyWarn from "eslint-plugin-only-warn"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
      // Allow `_`-prefixed args and vars to mark intentionally-unused
      // (interface contract, placeholder param, destructure rest, etc).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: [
      "dist/**",
      ".next/**",
      "**/.turbo/**",
      // The test coverage report, at the top of a workspace only: a route
      // folder named `coverage` is still linted.
      "coverage/**",
      // The preview app that `email dev` generates (git-ignored).
      ".react-email/**",
    ],
  },
]

const baseImportBans = config.find(
  (entry) => entry.rules?.["no-restricted-imports"]
).rules["no-restricted-imports"][1]

/**
 * The base import bans without the ones a package owns: for the package
 * that wraps a vendor (`packages/auth`, `packages/icons`). Setting
 * `no-restricted-imports` in a package's own config replaces the base
 * setting, so the owner has to carry the other bans; this carries them.
 *
 * @param {(module: string) => boolean} isOwned
 */
export function baseImportBansWithout(isOwned) {
  return ["error", importBansWithout(baseImportBans, isOwned)]
}

/** @param {{ paths?: object[], patterns?: object[] }} bans */
export function importBansWithout(bans, isOwned) {
  return {
    ...(bans.paths
      ? { paths: bans.paths.filter((path) => !isOwned(path.name)) }
      : {}),
    patterns: (bans.patterns ?? [])
      .map((pattern) => ({
        ...pattern,
        group: pattern.group.filter((module) => !isOwned(module)),
      }))
      .filter((pattern) => pattern.group.length > 0),
  }
}
