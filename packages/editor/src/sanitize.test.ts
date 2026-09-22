import { describe, expect, it } from "vitest"

import { buildLocalizedRichText } from "./build-localized-rich-text"
import { toSanitizedHtml } from "./sanitize"
import { toPlainText, toSanitizedHtmlFromValue } from "./serialize"
import { localizedRichTextWriteSchema, type PlateValue } from "./types"

const sample: PlateValue = [
  {
    type: "p",
    children: [{ text: "Hello " }, { text: "world", bold: true }],
  },
]

describe("toPlainText", () => {
  it("flattens marks into plain text", () => {
    expect(toPlainText(sample)).toBe("Hello world")
  })

  it("does not insert newlines around inline links", () => {
    const withLink: PlateValue = [
      {
        type: "p",
        children: [
          { text: "Visit " },
          {
            type: "a",
            url: "https://eleva.care",
            children: [{ text: "site" }],
          },
          { text: " now" },
        ],
      },
    ]
    expect(toPlainText(withLink)).toBe("Visit site now")
  })
})

describe("toSanitizedHtml", () => {
  it("strips script tags", () => {
    const dirty =
      "<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1) />"
    const clean = toSanitizedHtml(dirty)
    expect(clean).not.toMatch(/script/i)
    expect(clean).not.toMatch(/onerror/i)
    expect(clean).toContain("<p>ok</p>")
  })

  it("strips javascript: hrefs via allow-list", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>'
    const clean = toSanitizedHtml(dirty)
    expect(clean).not.toMatch(/javascript:/i)
  })

  it("keeps safe formatting tags", () => {
    const dirty = "<p><strong>Bold</strong> and <em>italic</em></p>"
    expect(toSanitizedHtml(dirty)).toBe(dirty)
  })
})

describe("toSanitizedHtmlFromValue", () => {
  it("emits sanitized markup from Plate JSON", () => {
    const html = toSanitizedHtmlFromValue(sample)
    expect(html).toContain("<p>")
    expect(html).toContain("<strong>world</strong>")
    expect(html).not.toMatch(/script/i)
  })
})

describe("localizedRichTextWriteSchema + buildLocalizedRichText", () => {
  it("rejects a missing source locale", () => {
    const parsed = localizedRichTextWriteSchema.safeParse({
      sourceLocale: "en",
      locales: {
        pt: { json: sample, source: "human" },
      },
    })
    expect(parsed.success).toBe(false)
  })

  it("rejects malformed Plate nodes", () => {
    const parsed = localizedRichTextWriteSchema.safeParse({
      sourceLocale: "en",
      locales: {
        en: {
          json: [{ text: "missing type and children" }],
          source: "human",
        },
      },
    })
    expect(parsed.success).toBe(false)
  })

  it("derives html and text server-side", () => {
    const write = localizedRichTextWriteSchema.parse({
      sourceLocale: "en",
      locales: {
        en: { json: sample, source: "human" },
      },
    })
    const stored = buildLocalizedRichText(write)
    expect(stored.en?.text).toBe("Hello world")
    expect(stored.en?.html).toContain("<strong>world</strong>")
    expect(stored.en?.source).toBe("human")
  })
})
