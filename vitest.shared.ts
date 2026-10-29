import { defineConfig } from "vitest/config"

/**
 * Shared vitest config. Per-package configs merge this as a base.
 * Keeps reporter, coverage, and environment defaults aligned across
 * @eleva/* packages.
 */
export const sharedConfig = defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".next", ".turbo"],
    passWithNoTests: true,
    // `pnpm test` runs ~50 turbo tasks at once; under that load the 5s default
    // flakes on file-walking and DB-mock suites that finish in <1s alone.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/*.config.{ts,js,mjs,cjs}",
        "**/index.ts",
      ],
    },
  },
})

export default sharedConfig
