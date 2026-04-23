import { defineWorkspace } from "vitest/config"

/**
 * Vitest workspace config.
 *
 * Each package with tests is listed here and picks up per-package
 * `vitest.config.ts` overrides. Run `pnpm test` at root to execute all.
 */
export default defineWorkspace([
  "packages/*",
  // Apps land later when they grow real tests; currently only packages.
])
