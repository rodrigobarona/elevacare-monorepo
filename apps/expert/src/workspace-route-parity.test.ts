import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The gateway only routes `/{slug}/team/*` to this app
 * (resolveExpertWorkspaceBase), so every workspace page under
 * `[orgSlug]/` needs a twin under `[orgSlug]/team/`. A page missing
 * there is a 404 for experts.
 */
const ROOT = join(__dirname, "app", "[orgSlug]")
const TEAM = join(ROOT, "team")

/** Route files (`page.tsx`) under `dir`, relative to it. */
function pages(dir: string, skip?: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (full === skip) return []
    if (statSync(full).isDirectory()) {
      return pages(full, skip).map((p) => join(name, p))
    }
    return name === "page.tsx" ? [name] : []
  })
}

describe("expert workspace route parity", () => {
  it("serves every workspace page under /{slug}/team", () => {
    // The workspace home is team/page.tsx itself.
    const root = pages(ROOT, TEAM).filter((p) => p !== "page.tsx")
    const team = new Set(pages(TEAM))
    const missing = root.filter((p) => !team.has(p))
    expect(missing).toEqual([])
  })
})
