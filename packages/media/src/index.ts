import type { Locale } from "@eleva/config/i18n-locales"
import { mediaUrl } from "@eleva/config/media-host"

import library from "./library.json"
import type {
  MediaAsset,
  MediaEntry,
  MediaImage,
  MediaImageEntry,
  MediaVideo,
  MediaVideoEntry,
} from "./types"

export type {
  LocalizedText,
  MediaAsset,
  MediaCredit,
  MediaEntry,
  MediaImage,
  MediaLicense,
  MediaVideo,
} from "./types"

const ENTRIES = library as MediaEntry[]
const BY_SLUG = new Map(ENTRIES.map((entry) => [entry.slug, entry]))

function resolveImage({ key, ...entry }: MediaImageEntry): MediaImage {
  return { ...entry, url: mediaUrl(key) }
}

function resolveVideo({
  key,
  webmKey,
  posterKey,
  ...entry
}: MediaVideoEntry): MediaVideo {
  return {
    ...entry,
    url: mediaUrl(key),
    ...(webmKey ? { webmUrl: mediaUrl(webmKey) } : {}),
    poster: mediaUrl(posterKey),
  }
}

function resolveAsset(entry: MediaEntry): MediaAsset {
  return entry.kind === "image" ? resolveImage(entry) : resolveVideo(entry)
}

/** Raw manifest entries with object keys, for curation and migration. */
export function listMediaEntries(): readonly MediaEntry[] {
  return ENTRIES
}

export function listMedia(): readonly MediaAsset[] {
  return ENTRIES.map(resolveAsset)
}

export function getImage(slug: string): MediaImage {
  const entry = BY_SLUG.get(slug)
  if (entry?.kind !== "image") {
    throw new Error(`@eleva/media: no image "${slug}" in library.json`)
  }
  return resolveImage(entry)
}

export function getVideo(slug: string): MediaVideo {
  const entry = BY_SLUG.get(slug)
  if (entry?.kind !== "video") {
    throw new Error(`@eleva/media: no video "${slug}" in library.json`)
  }
  return resolveVideo(entry)
}

export function altText(asset: MediaAsset, locale: Locale): string {
  return asset.alt[locale]
}

/** Assets that need visible attribution (Pexels asks for photographer credit). */
export function creditedMedia(): MediaImage[] {
  return listMedia().filter(
    (asset): asset is MediaImage =>
      asset.kind === "image" && asset.license === "pexels"
  )
}
