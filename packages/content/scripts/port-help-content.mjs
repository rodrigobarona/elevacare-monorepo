/**
 * Port legacy help MDX → packages/content/content/help/{members,experts,clinics}
 * Run: node packages/content/scripts/port-help-content.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../..")
const legacyRoot = path.join(
  repoRoot,
  "_context/clone-repo/eleva-care-app/src/content/help"
)
const helpRoot = path.join(repoRoot, "packages/content/content/help")

const PORTALS = [
  { id: "members", legacy: "patient", locales: ["en", "pt"] },
  { id: "experts", legacy: "expert", locales: ["en", "pt"] },
  { id: "clinics", legacy: "workspace", locales: ["en"] },
]

function sanitize(body) {
  return body
    .replace(/\bpatients\b/gi, "members")
    .replace(/\bpatient\b/gi, "member")
    .replace(/\bworkspace\b/gi, "clinic")
    .replace(/Top Expert/gi, "verified expert")
    .replace(/\bClerk\b/g, "Better Auth")
    .replace(/\bWorkOS\b/g, "Better Auth")
    .replace(/\/help\/patient/g, "/members")
    .replace(/\/help\/member/g, "/members")
    .replace(/\/help\/expert/g, "/experts")
    .replace(/\/help\/workspace/g, "/clinics")
    .replace(/\/help\/clinic/g, "/clinics")
    .replace(
      /\/experts\/top-expert\/[^)\s"]+/g,
      "/experts/getting-started/profile"
    )
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { body: raw, fm: {} }
  const end = raw.indexOf("\n---", 4)
  if (end === -1) return { body: raw, fm: {} }
  const block = raw.slice(4, end)
  const fm = {}
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if (val.startsWith('"')) val = JSON.parse(val)
    fm[key] = val
  }
  return { body: raw.slice(end + 4).trimStart(), fm }
}

function stripExports(body) {
  return body.replace(/^export const metadata[\s\S]*?;\s*\n/m, "").trim()
}

function walkMdx(dir, base = dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkMdx(full, base))
    else if (entry.name.endsWith(".mdx")) {
      out.push({ rel: path.relative(base, full), full })
    }
  }
  return out
}

function writeMetaForDir(dir, title, pages) {
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    `${JSON.stringify({ title, pages: [...pages].sort() }, null, 2)}\n`,
    "utf8"
  )
}

for (const portal of PORTALS) {
  const legacyDir = path.join(legacyRoot, portal.legacy)
  const files = walkMdx(legacyDir)

  for (const locale of portal.locales) {
    const localePrefix = `${locale}${path.sep}`
    const localeFiles = files.filter((f) => f.rel.startsWith(localePrefix))
    const outLocaleRoot = path.join(helpRoot, portal.id, locale)
    fs.mkdirSync(outLocaleRoot, { recursive: true })

    const rootPages = new Set()
    const folderPages = new Map()

    for (const { rel, full } of localeFiles) {
      if (rel.includes(`${path.sep}top-expert${path.sep}`)) continue
      const afterLocale = rel.slice(localePrefix.length)
      if (!afterLocale.endsWith(".mdx")) continue

      const raw = fs.readFileSync(full, "utf8")
      const { body, fm } = parseFrontmatter(raw)
      const cleaned = sanitize(stripExports(body))

      const segments = afterLocale.replace(/\.mdx$/, "").split(path.sep)
      const fileName = segments.at(-1)
      const subdirs = segments.slice(0, -1)
      const outDir = path.join(outLocaleRoot, ...subdirs)
      fs.mkdirSync(outDir, { recursive: true })

      const title = fm.title ?? fileName ?? "Help"
      const description =
        fm.description ?? `Help for ${portal.id} on Eleva.care.`

      fs.writeFileSync(
        path.join(outDir, `${fileName}.mdx`),
        `---
title: ${JSON.stringify(String(title)).slice(1, -1)}
description: ${JSON.stringify(String(description)).slice(1, -1)}
---

${cleaned}
`,
        "utf8"
      )
      console.log(
        "wrote",
        path.relative(repoRoot, path.join(outDir, `${fileName}.mdx`))
      )

      if (subdirs.length === 0) {
        rootPages.add(fileName === "index" ? "index" : fileName)
      } else {
        const folder = subdirs.join("/")
        if (!folderPages.has(folder)) folderPages.set(folder, new Set())
        folderPages.get(folder).add(fileName === "index" ? "index" : fileName)
      }
    }

    const portalTitle =
      portal.id === "members"
        ? "Members"
        : portal.id === "experts"
          ? "Experts"
          : "Clinics"
    writeMetaForDir(
      outLocaleRoot,
      portalTitle,
      rootPages.size ? rootPages : new Set(["index"])
    )
    for (const [folder, pages] of folderPages) {
      writeMetaForDir(
        path.join(outLocaleRoot, ...folder.split("/")),
        folder.split("/").at(-1) ?? folder,
        pages
      )
    }
  }
}

console.log("help port done")
