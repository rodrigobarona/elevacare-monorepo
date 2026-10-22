import type { Locale } from "@eleva/config/i18n-locales"

export type LocalizedText = Record<Locale, string>

export type MediaLicense = "eleva-owned" | "pexels"

export interface MediaCredit {
  name: string
  url?: string
}

export interface MediaImage {
  kind: "image"
  slug: string
  url: string
  width: number
  height: number
  blurDataURL: string
  avgColor?: string
  alt: LocalizedText
  tags: string[]
  license: MediaLicense
  credit: MediaCredit
  source: {
    provider: "eleva" | "pexels"
    id?: string
    pageUrl?: string
  }
}

export interface MediaVideo {
  kind: "video"
  slug: string
  url: string
  poster: string
  blurDataURL: string
  width: number
  height: number
  alt: LocalizedText
  tags: string[]
  license: MediaLicense
  credit: MediaCredit
  source: {
    provider: "eleva"
  }
}

export type MediaAsset = MediaImage | MediaVideo
