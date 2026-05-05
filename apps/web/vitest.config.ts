import { existsSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vitest/config"

import sharedConfig from "../../vitest.shared"

const root = dirname(fileURLToPath(import.meta.url))

/**
 * Mirror the `@/*` alias from tsconfig.json (`"@/*": ["./*"]`).
 * Candidates must be regular files — `existsSync` returns true for
 * directories, so a bare `@/lib` would otherwise resolve to
 * `apps/web/lib/` and break vite's module loader.
 */
function tsconfigAtAliasPlugin(): Plugin {
  return {
    name: "eleva:web-at-alias",
    enforce: "pre",
    resolveId(source) {
      const m = /^@\/(.+)$/.exec(source)
      if (!m) return null
      const tail = m[1]!
      const exts = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"]
      for (const ext of exts) {
        const candidate = `${resolve(root, tail)}${ext}`
        if (!existsSync(candidate)) continue
        try {
          if (statSync(candidate).isFile()) return candidate
        } catch {
          // ignore unreadable entries
        }
      }
      return null
    },
  }
}

export default defineConfig({
  ...sharedConfig,
  plugins: [tsconfigAtAliasPlugin()],
  test: {
    ...sharedConfig.test,
    include: ["lib/**/*.{test,spec}.ts"],
  },
})
