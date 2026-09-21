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

const RESEND_IMPORT =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']resend(?:\/[^"']*)?["']/

describe("auth notification boundary", () => {
  it("does not import @eleva/notifications or resend", () => {
    const files = walk(join(root, "src"))
    const hits: string[] = []
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      if (
        source.includes("@eleva/notifications") ||
        RESEND_IMPORT.test(source)
      ) {
        hits.push(file.slice(root.length + 1))
      }
    }
    expect(hits).toEqual([])
  })

  it("detects side-effect, dynamic, require, and subpath Resend imports", () => {
    expect(RESEND_IMPORT.test('import "resend"')).toBe(true)
    expect(RESEND_IMPORT.test("import('resend')")).toBe(true)
    expect(RESEND_IMPORT.test('require("resend")')).toBe(true)
    expect(RESEND_IMPORT.test('from "resend/emails"')).toBe(true)
    expect(RESEND_IMPORT.test('from "@eleva/email"')).toBe(false)
  })
})
