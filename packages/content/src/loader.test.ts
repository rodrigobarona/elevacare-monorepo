import { describe, expect, it } from "vitest"
import { createFumadocsContentLoader } from "./loader"
import { legalFrontmatterSchema } from "./schemas"

const Body = () => null

function page(locale: string, slugs: string[], title: string) {
  return {
    slugs,
    url: `/${locale}/${slugs.join("/")}`,
    locale,
    data: {
      title,
      description: `${title} description`,
      lastUpdated: "2026-10-21",
      body: Body,
      toc: [{ title: "Intro", url: "#intro", depth: 2 }],
      extra: "dropped",
    },
  }
}

const pages = {
  en: [page("en", ["terms"], "Terms")],
  pt: [page("pt", ["terms"], "Termos")],
}

const source = {
  getPage(slugs: string[] | undefined, language?: string) {
    const list = pages[language as keyof typeof pages] ?? pages.en
    return list.find((p) => p.slugs.join("/") === slugs?.join("/"))
  },
  getPages(language?: string) {
    return pages[language as keyof typeof pages] ?? pages.en
  },
  getPageTree() {
    return { name: "root", children: [] }
  },
}

describe("createFumadocsContentLoader", () => {
  const loader = createFumadocsContentLoader(source, legalFrontmatterSchema)

  it("returns parsed frontmatter, body and toc for a slug", () => {
    const doc = loader.getDocument(["terms"], "pt")
    expect(doc?.frontmatter).toEqual({
      title: "Termos",
      description: "Termos description",
      noindex: false,
      lastUpdated: "2026-10-21",
    })
    expect(doc?.Body).toBe(Body)
    expect(doc?.toc).toHaveLength(1)
    expect(doc?.locale).toBe("pt")
  })

  it("reports the source locale when a translation falls back", () => {
    const doc = loader.getDocument(["terms"], "es")
    expect(doc?.locale).toBe("en")
  })

  it("returns undefined for an unknown slug", () => {
    expect(loader.getDocument(["missing"], "en")).toBeUndefined()
  })

  it("lists documents for a locale", () => {
    expect(loader.listDocuments("en").map((d) => d.url)).toEqual(["/en/terms"])
  })
})
