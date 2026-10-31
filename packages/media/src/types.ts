import type { Locale } from "@eleva/config/i18n-locales"

export type LocalizedText = Record<Locale, string>

export type MediaLicense = "eleva-owned" | "pexels"

export interface MediaCredit {
  name: string
  url?: string
}

interface MediaImageFields {
  kind: "image"
  slug: string
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

interface MediaVideoFields {
  kind: "video"
  slug: string
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

/** `library.json` stores object keys, so a host change is one env var. */
export interface MediaImageEntry extends MediaImageFields {
  key: string
}

export interface MediaVideoEntry extends MediaVideoFields {
  /** Progressive MP4 (H.264) — Safari / universal fallback. */
  key: string
  /** Optional progressive WebM (VP9); browsers that support it pick this first. */
  webmKey?: string
  posterKey: string
}

export type MediaEntry = MediaImageEntry | MediaVideoEntry

export interface MediaImage extends MediaImageFields {
  url: string
}

export interface MediaVideo extends MediaVideoFields {
  url: string
  webmUrl?: string
  poster: string
}

export type MediaAsset = MediaImage | MediaVideo
