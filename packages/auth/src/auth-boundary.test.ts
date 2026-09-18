import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      files.push(...walk(path))
      continue
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !entry.name.includes(".test."))
      files.push(path)
  }
  return files
}

describe("auth notification boundary", () => {
  it("does not import @eleva/notifications or resend", () => {
    const files = walk(join(root, "src"))
    const hits: string[] = []
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      if (
        source.includes("@eleva/notifications") ||
        /from ["']resend["']/.test(source)
      ) {
        hits.push(file.slice(root.length + 1))
      }
    }
    expect(hits).toEqual([])
  })
})
