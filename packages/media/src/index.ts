import type { Locale } from "@eleva/config/i18n-locales"

import library from "./library.json"
import type { MediaAsset, MediaImage, MediaVideo } from "./types"

export type {
  LocalizedText,
  MediaAsset,
  MediaCredit,
  MediaImage,
  MediaLicense,
  MediaVideo,
} from "./types"

const ASSETS = library as MediaAsset[]
const BY_SLUG = new Map(ASSETS.map((asset) => [asset.slug, asset]))

export function listMedia(): readonly MediaAsset[] {
  return ASSETS
}

export function getImage(slug: string): MediaImage {
  const asset = BY_SLUG.get(slug)
  if (asset?.kind !== "image") {
    throw new Error(`@eleva/media: no image "${slug}" in library.json`)
  }
  return asset
}

export function getVideo(slug: string): MediaVideo {
  const asset = BY_SLUG.get(slug)
  if (asset?.kind !== "video") {
    throw new Error(`@eleva/media: no video "${slug}" in library.json`)
  }
  return asset
}

export function altText(asset: MediaAsset, locale: Locale): string {
  return asset.alt[locale]
}

/** Assets that need visible attribution (Pexels asks for photographer credit). */
export function creditedMedia(): MediaImage[] {
  return ASSETS.filter(
    (asset): asset is MediaImage =>
      asset.kind === "image" && asset.license === "pexels"
  )
}
