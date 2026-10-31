"use client"

import Image from "next/image"
import { useSyncExternalStore } from "react"

import type { Locale } from "@eleva/config/i18n-locales"
import { cn } from "@eleva/ui/lib/utils"

import { getVideo } from "./index"

const AMBIENT_VIDEO =
  "(prefers-reduced-motion: no-preference) and (min-width: 1024px)"

function subscribeAmbientVideo(onChange: () => void) {
  const query = window.matchMedia(AMBIENT_VIDEO)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function useAmbientVideo(): boolean {
  return useSyncExternalStore(
    subscribeAmbientVideo,
    () => window.matchMedia(AMBIENT_VIDEO).matches,
    () => false
  )
}

/**
 * Muted, looping ambient video (hero/backdrops) with a poster underneath.
 * Progressive WebM (when curated) then MP4 on the media host — no third-party
 * player or tracking. Reduced motion and small screens show the poster only,
 * so phones never download the video.
 */
export function ElevaVideo({
  slug,
  locale,
  className,
  sizes = "100vw",
  priority = false,
}: {
  slug: string
  locale: Locale
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const video = getVideo(slug)
  const showVideo = useAmbientVideo()
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={video.poster}
        alt={video.alt[locale]}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={video.blurDataURL}
        className="object-cover"
      />
      {showVideo ? (
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
      ) : null}
    </div>
  )
}
