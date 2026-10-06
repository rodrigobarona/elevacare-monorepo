import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"
import { generateOpenApiSpec } from "./openapi"

const APP_DIR = join(__dirname, "..", "app")

/** Routes documented elsewhere or not part of the public contract. */
const UNDOCUMENTED = new Set([
  "/auth/{...all}",
  "/auth/ok",
  "/auth/e2e/verify-email",
  "/openapi.json",
])

function routePaths(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routePaths(full))
    else if (entry === "route.ts") {
      const rel = relative(APP_DIR, dir).split(sep).join("/")
      out.push(`/${rel}`.replace(/\[([^\]]+)\]/g, "{$1}"))
    }
  }
  return out
}

describe("OpenAPI coverage", () => {
  it("documents every apps/api route handler", () => {
    const documented = new Set(Object.keys(generateOpenApiSpec().paths ?? {}))
    const missing = routePaths(APP_DIR)
      .filter((path) => !UNDOCUMENTED.has(path) && !documented.has(path))
      .sort()
    expect(missing).toEqual([])
  })
})
