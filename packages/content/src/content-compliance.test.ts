import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { CONTENT_LOCALES } from "./locales"
import { legalFrontmatterSchema, pageFrontmatterSchema } from "./schemas"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contentRoot = path.join(__dirname, "../content")

const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "health-data",
  "ai-processing",
  "cookies",
  "payments",
  "expert-agreement",
  "accessibility",
  "complaints",
] as const

const TRUST_SLUGS = ["security", "dpa", "sub-processors", "ers"] as const

/** Vendors named in trust EN sub-processors table (first column). */
const SUB_PROCESSOR_VENDORS = [
  "Vercel",
  "Neon",
  "Upstash",
  "Resend",
  "Stripe",
  "Daily",
  "Sentry",
  "Inth",
] as const

const factSheetPath = path.join(
  __dirname,
  "../../../docs/eleva-v3/legal/fact-sheet.md"
)

const PAGE_SLUGS = ["evidence-based-care"] as const

const BANNED = [
  /\bpatient\b/i,
  /\bpatients\b/i,
  /\bworkspace\b/i,
  /\bpt-BR\b/i,
  /\bClerk\b/,
  /\bWorkOS\b/,
] as const

function readMdx(collection: string, locale: string, slug: string): string {
  return fs.readFileSync(
    path.join(contentRoot, collection, locale, `${slug}.mdx`),
    "utf8"
  )
}

function walkMdx(dir: string, out: string[]) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) {
      walkMdx(full, out)
      continue
    }
    if (name.endsWith(".mdx")) out.push(full)
  }
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  expect(match, "frontmatter block").toBeTruthy()
  const fm: Record<string, unknown> = {}
  for (const line of match![1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value: unknown = line.slice(idx + 1).trim()
    if (value === "true") value = true
    if (value === "false") value = false
    if (typeof value === "string" && value.startsWith('"')) {
      value = JSON.parse(value)
    }
    fm[key] = value
  }
  return fm
}

describe("content compliance", () => {
  it("has every legal and trust slug in en/pt/es", () => {
    for (const slug of LEGAL_SLUGS) {
      for (const locale of CONTENT_LOCALES) {
        expect(
          fs.existsSync(path.join(contentRoot, "legal", locale, `${slug}.mdx`)),
          `legal/${locale}/${slug}.mdx`
        ).toBe(true)
      }
    }
    for (const slug of TRUST_SLUGS) {
      for (const locale of CONTENT_LOCALES) {
        expect(
          fs.existsSync(path.join(contentRoot, "trust", locale, `${slug}.mdx`)),
          `trust/${locale}/${slug}.mdx`
        ).toBe(true)
      }
    }
    for (const slug of PAGE_SLUGS) {
      for (const locale of CONTENT_LOCALES) {
        expect(
          fs.existsSync(path.join(contentRoot, "pages", locale, `${slug}.mdx`)),
          `pages/${locale}/${slug}.mdx`
        ).toBe(true)
      }
    }
  })

  it("parses legal and page frontmatter", () => {
    for (const slug of LEGAL_SLUGS) {
      for (const locale of CONTENT_LOCALES) {
        const raw = readMdx("legal", locale, slug)
        legalFrontmatterSchema.parse(parseFrontmatter(raw))
      }
    }
    for (const slug of PAGE_SLUGS) {
      for (const locale of CONTENT_LOCALES) {
        const raw = readMdx("pages", locale, slug)
        pageFrontmatterSchema.parse(parseFrontmatter(raw))
      }
    }
  })

  it("has help portal index files for members and experts in en/pt/es", () => {
    for (const portal of ["members", "experts", "clinics"] as const) {
      for (const locale of CONTENT_LOCALES) {
        expect(
          fs.existsSync(
            path.join(contentRoot, "help", portal, locale, "index.mdx")
          ),
          `help/${portal}/${locale}/index.mdx`
        ).toBe(true)
      }
    }
  })

  it("does not keep legacy /help/ links inside help MDX", () => {
    const files: string[] = []
    for (const portal of fs.readdirSync(path.join(contentRoot, "help"))) {
      const portalDir = path.join(contentRoot, "help", portal)
      if (!fs.statSync(portalDir).isDirectory()) continue
      for (const locale of fs.readdirSync(portalDir)) {
        walkMdx(path.join(portalDir, locale), files)
      }
    }
    for (const file of files) {
      const body = fs
        .readFileSync(file, "utf8")
        .split("---")
        .slice(2)
        .join("---")
      expect(body, file).not.toMatch(/\/help\//)
    }
  })

  it("resolves internal help links to existing MDX paths", () => {
    const linkRe = /(?:href=\{?"|]\()(\/(?:members|experts|clinics)[^)\s"#]*)/g
    for (const portal of ["members", "experts", "clinics"] as const) {
      for (const locale of fs.readdirSync(
        path.join(contentRoot, "help", portal)
      )) {
        const localeDir = path.join(contentRoot, "help", portal, locale)
        if (!fs.statSync(localeDir).isDirectory()) continue
        const mdxFiles: string[] = []
        walkMdx(localeDir, mdxFiles)
        for (const file of mdxFiles) {
          const body = fs
            .readFileSync(file, "utf8")
            .split("---")
            .slice(2)
            .join("---")
          let match: RegExpExecArray | null
          while ((match = linkRe.exec(body)) !== null) {
            const href = match[1].split("#")[0]
            const rel = href.replace(/^\/(members|experts|clinics)\/?/, "")
            const target = rel
              ? path.join(localeDir, `${rel}.mdx`)
              : path.join(localeDir, "index.mdx")
            const asIndex = path.join(localeDir, rel, "index.mdx")
            const exists =
              fs.existsSync(target) ||
              fs.existsSync(asIndex) ||
              fs.existsSync(
                path.join(localeDir, rel.replace(/\/$/, ""), "index.mdx")
              )
            expect(exists, `${file} → ${href}`).toBe(true)
          }
        }
      }
    }
  })

  it("lists sub-processors that match the legal fact sheet when present", () => {
    const subProcessors = readMdx("trust", "en", "sub-processors")
    for (const vendor of SUB_PROCESSOR_VENDORS) {
      expect(subProcessors, `sub-processors.mdx mentions ${vendor}`).toContain(
        vendor
      )
    }
    if (!fs.existsSync(factSheetPath)) {
      return
    }
    const factSheet = fs.readFileSync(factSheetPath, "utf8")
    for (const vendor of SUB_PROCESSOR_VENDORS) {
      expect(
        factSheet.toLowerCase(),
        `fact-sheet mentions ${vendor}`
      ).toContain(vendor.toLowerCase())
    }
  })

  it("avoids banned terminology in public MDX bodies", () => {
    const files: string[] = []
    for (const collection of ["legal", "trust", "pages", "help"] as const) {
      if (collection === "help") {
        for (const portal of fs.readdirSync(path.join(contentRoot, "help"))) {
          const portalDir = path.join(contentRoot, "help", portal)
          if (!fs.statSync(portalDir).isDirectory()) continue
          for (const locale of fs.readdirSync(portalDir)) {
            const localeDir = path.join(portalDir, locale)
            if (!fs.statSync(localeDir).isDirectory()) continue
            walkMdx(localeDir, files)
          }
        }
        continue
      }
      for (const locale of CONTENT_LOCALES) {
        const dir = path.join(contentRoot, collection, locale)
        if (!fs.existsSync(dir)) continue
        walkMdx(dir, files)
      }
    }
    for (const file of files) {
      const body = fs
        .readFileSync(file, "utf8")
        .split("---")
        .slice(2)
        .join("---")
      for (const pattern of BANNED) {
        expect(body, `${path.basename(file)}: ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})
