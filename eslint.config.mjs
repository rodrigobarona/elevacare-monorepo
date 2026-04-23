import { config } from "@eleva/eslint-config/base"

/**
 * Root ESLint config for files at the repository root (vitest configs,
 * commitlint config, etc.). Package/app configs override per directory.
 *
 * @type {import("eslint").Linter.Config}
 */
export default [
  ...config,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      ".turbo/**",
      "apps/**",
      "packages/**",
      "infra/**",
      "_context/**",
      "docs/**",
    ],
  },
  {
    ignores: [
      "node_modules/**",
      ".turbo/**",
      "apps/**",
      "packages/**",
      "infra/**",
      "_context/**",
      "docs/**",
      ".husky/**",
      ".cursor/**",
      ".vercel/**",
      ".github/**",
    ],
  },
]
