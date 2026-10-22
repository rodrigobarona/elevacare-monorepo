import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const helpRoot = path.resolve(
  __dirname,
  "../../../packages/content/content/help"
)
const publicDir = path.resolve(__dirname, "../public")
const locales = ["en", "pt", "es"]
const portals = ["members", "experts", "clinics"]

function parseTitle(raw) {
  const match = raw.match(/^title:\s*(.+)$/m)
  if (!match) return null
  let val = match[1].trim()
  if (val.startsWith('"')) {
    try {
      val = JSON.parse(val)
    } catch {
      val = val.replace(/^"|"$/g, "")
    }
  }
  return val
}

function stripFrontmatter(raw) {
  if (!raw.startsWith("---")) return raw
  const end = raw.indexOf("\n---", 3)
  if (end === -1) return raw
  return raw.slice(end + 4)
}

function plainTextExcerpt(raw, max = 240) {
  const body = stripFrontmatter(raw)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return body.slice(0, max)
}

/** @type {Array<{ url: string, title: string, portal: string, locale: string, excerpt: string }>} */
const searchIndex = []

function collectMdx(dir, base, locale, portal, lines) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectMdx(full, base, locale, portal, lines)
    } else if (entry.name.endsWith(".mdx")) {
      const raw = fs.readFileSync(full, "utf8")
      const rel = path.relative(base, full).replace(/\.mdx$/, "")
      const slug = rel === "index" ? "" : `/${rel}`
      const prefix = locale === "en" ? "" : `/${locale}`
      const url = `${prefix}/${portal}${slug}`
      const title = parseTitle(raw) ?? rel
      lines.push(`- [${title}](${url})`)
      searchIndex.push({
        url,
        title,
        portal,
        locale,
        excerpt: plainTextExcerpt(raw),
      })
    }
  }
}

const lines = [
  "# Eleva.care help center",
  "",
  "Generated at build time from @eleva/content help MDX.",
  "",
]

for (const portal of portals) {
  lines.push(`## ${portal}`, "")
  for (const locale of locales) {
    const dir = path.join(helpRoot, portal, locale)
    if (!fs.existsSync(dir)) continue
    if (locale !== "en") lines.push(`### ${locale}`, "")
    collectMdx(dir, dir, locale, portal, lines)
    lines.push("")
  }
}

fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, "llms.txt"), lines.join("\n"), "utf8")
fs.writeFileSync(
  path.join(publicDir, "help-search-index.json"),
  JSON.stringify(searchIndex),
  "utf8"
)
console.log("wrote public/llms.txt and public/help-search-index.json")
