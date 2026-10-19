import Image, { type ImageProps } from "next/image"

import type { Locale } from "@eleva/config/i18n-locales"

import { getImage } from "./index"

type ElevaImageProps = Omit<
  ImageProps,
  "src" | "alt" | "width" | "height" | "placeholder" | "blurDataURL"
> & {
  slug: string
  locale: Locale
  /** Decorative images render with an empty alt so screen readers skip them. */
  decorative?: boolean
}

/** Curated library image: blur placeholder, intrinsic size and localized alt. */
export function ElevaImage({
  slug,
  locale,
  decorative = false,
  fill,
  sizes,
  ...props
}: ElevaImageProps) {
  const image = getImage(slug)
  const alt = decorative ? "" : image.alt[locale]
  const common = {
    src: image.url,
    alt,
    placeholder: "blur" as const,
    blurDataURL: image.blurDataURL,
    sizes: sizes ?? (fill ? "100vw" : undefined),
    ...props,
  }
  return fill ? (
    <Image {...common} fill />
  ) : (
    <Image {...common} width={image.width} height={image.height} />
  )
}
