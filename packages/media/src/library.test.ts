import { describe, expect, it } from "vitest"

import { locales } from "@eleva/config/i18n-locales"

import { creditedMedia, getImage, getVideo, listMedia } from "./index"

const BLOB_HOST =
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/media\//

describe("@eleva/media library", () => {
  it("has unique kebab-case slugs", () => {
    const slugs = listMedia().map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it("localizes alt text for every supported locale", () => {
    for (const asset of listMedia()) {
      for (const locale of locales) {
        expect(
          asset.alt[locale]?.trim(),
          `${asset.slug} ${locale}`
        ).toBeTruthy()
      }
    }
  })

  it("serves images from the public Blob store with intrinsic size and blur", () => {
    for (const asset of listMedia()) {
      if (asset.kind !== "image") continue
      expect(asset.url).toMatch(BLOB_HOST)
      expect(asset.width).toBeGreaterThan(0)
      expect(asset.height).toBeGreaterThan(0)
      expect(asset.blurDataURL).toMatch(/^data:image\//)
    }
  })

  it("records photographer credit and source for Pexels images", () => {
    for (const asset of creditedMedia()) {
      expect(asset.credit.name).toBeTruthy()
      expect(asset.credit.url).toMatch(/^https:\/\/www\.pexels\.com\//)
      expect(asset.source.pageUrl).toMatch(
        /^https:\/\/www\.pexels\.com\/photo\//
      )
    }
  })

  it("serves hero video from public Blob with poster and blur", () => {
    const hero = getVideo("hero-intro")
    expect(hero.url).toMatch(BLOB_HOST)
    expect(hero.url).toMatch(/\.mp4(?:\?|$)/)
    expect(hero.webmUrl).toMatch(BLOB_HOST)
    expect(hero.webmUrl).toMatch(/\.webm(?:\?|$)/)
    expect(hero.poster).toMatch(BLOB_HOST)
    expect(hero.width).toBeGreaterThan(0)
    expect(hero.height).toBeGreaterThan(0)
    expect(hero.blurDataURL).toMatch(/^data:image\//)
    expect(hero.source.provider).toBe("eleva")
  })

  it("throws for unknown slugs and kind mismatches", () => {
    expect(() => getImage("missing")).toThrow(/no image/)
    expect(() => getImage("hero-intro")).toThrow(/no image/)
    expect(() => getVideo("service-pregnancy")).toThrow(/no video/)
  })
})
