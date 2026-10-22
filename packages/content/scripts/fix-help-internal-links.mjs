/**
 * Rewrite legacy /help/{patient,expert,workspace} links to docs portal paths.
 * Run: node packages/content/scripts/fix-help-internal-links.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const helpRoot = path.resolve(__dirname, "../content/help")

const HREF_REPLACEMENTS = [
  [/\/help\/patient/g, "/members"],
  [/\/help\/member/g, "/members"],
  [/\/help\/expert/g, "/experts"],
  [/\/help\/workspace/g, "/clinics"],
  [/\/help\/clinic/g, "/clinics"],
]

const TOP_EXPERT_HREF = /\/experts\/top-expert\/[^)\s"]+/g

function rewriteBody(body) {
  let out = body
  for (const [from, to] of HREF_REPLACEMENTS) {
    out = out.replace(from, to)
  }
  out = out.replace(TOP_EXPERT_HREF, "/experts/getting-started/profile")
  return out
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith(".mdx")) {
      const raw = fs.readFileSync(full, "utf8")
      const parts = raw.split("---")
      if (parts.length < 3) continue
      const fm = parts.slice(0, 2).join("---") + "---"
      const body = parts.slice(2).join("---")
      const next = rewriteBody(body)
      if (next !== body) {
        fs.writeFileSync(full, fm + next, "utf8")
        console.log("fixed", path.relative(helpRoot, full))
      }
    }
  }
}

walk(helpRoot)
console.log("help link fix done")
