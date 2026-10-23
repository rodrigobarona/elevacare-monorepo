"use client"

import Image from "next/image"
import { useSyncExternalStore } from "react"

import type { Locale } from "@eleva/config/i18n-locales"
import { cn } from "@eleva/ui/lib/utils"

import { getVideo } from "./index"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true
  )
}

/**
 * Muted, looping ambient video (hero/backdrops) with a poster underneath.
 * Progressive WebM (when curated) then MP4 on public Blob — no third-party
 * player or tracking. Reduced motion shows the poster only.
 */
export function ElevaVideo({
  slug,
  locale,
  className,
  priority = false,
}: {
  slug: string
  locale: Locale
  className?: string
  priority?: boolean
}) {
  const video = getVideo(slug)
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={video.poster}
        alt={video.alt[locale]}
        fill
        sizes="100vw"
        priority={priority}
        placeholder="blur"
        blurDataURL={video.blurDataURL}
        className="object-cover"
      />
      {reducedMotion ? null : (
        <video
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          tabIndex={-1}
          className="absolute inset-0 size-full object-cover"
        >
          {video.webmUrl ? (
            <source src={video.webmUrl} type="video/webm" />
          ) : null}
          <source src={video.url} type="video/mp4" />
        </video>
      )}
    </div>
  )
}
