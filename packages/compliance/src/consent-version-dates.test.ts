import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  AI_PROCESSING_DOCUMENT_SLUG,
  CONSENT_DOCUMENT_SLUGS,
  CONSENT_DOCUMENT_VERSION,
} from "./consents"

const LOCALES = ["en", "pt", "es"] as const
const SLUGS = [
  ...new Set([
    ...Object.values(CONSENT_DOCUMENT_SLUGS),
    AI_PROCESSING_DOCUMENT_SLUG,
  ]),
]

function lastUpdated(locale: string, slug: string): string {
  const file = new URL(
    `../../content/content/legal/${locale}/${slug}.mdx`,
    import.meta.url
  )
  const match = /^lastUpdated:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(
    readFileSync(file, "utf8")
  )
  if (!match?.[1]) throw new Error(`no lastUpdated in ${locale}/${slug}`)
  return match[1]
}

describe("CONSENT_DOCUMENT_VERSION", () => {
  // A consent records this version as proof of the text the person saw
  // (GDPR art. 7(1)). A document changed after it would make that proof
  // point at two different texts.
  it.each(LOCALES.flatMap((locale) => SLUGS.map((slug) => [locale, slug])))(
    "is not older than %s/%s",
    (locale, slug) => {
      expect(lastUpdated(locale, slug) <= CONSENT_DOCUMENT_VERSION).toBe(true)
    }
  )
})
