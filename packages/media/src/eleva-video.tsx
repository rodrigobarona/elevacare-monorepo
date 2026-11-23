"use client"

import Image from "next/image"
import { useRef, useState, useSyncExternalStore } from "react"

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
 *
 * Pass `pause` whenever the film runs for more than five seconds: it adds a
 * button that stops and restarts it (WCAG 2.2.2). `onTime` reports the
 * playhead, so words that follow the film stop with it.
 */
export function ElevaVideo({
  slug,
  locale,
  className,
  sizes = "100vw",
  priority = false,
  pause,
  onTime,
}: {
  slug: string
  locale: Locale
  className?: string
  sizes?: string
  priority?: boolean
  /**
   * Names (and optional classes) for the pause and play button. With `icons`
   * the button shows the icon and carries the name for assistive technology;
   * without them it shows the name.
   */
  pause?: {
    pauseLabel: string
    playLabel: string
    className?: string
    icons?: { pause: React.ReactNode; play: React.ReactNode }
  }
  /** Called with the playhead in seconds while the film plays. */
  onTime?: (seconds: number) => void
}) {
  const video = getVideo(slug)
  const showVideo = useAmbientVideo()
  const element = useRef<HTMLVideoElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  function toggle() {
    const film = element.current
    if (!film) return
    if (film.paused) {
      void film.play()
      setIsPaused(false)
    } else {
      film.pause()
      setIsPaused(true)
    }
  }

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
        <>
          <video
            ref={element}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 size-full object-cover"
            onTimeUpdate={
              onTime
                ? (event) => onTime(event.currentTarget.currentTime)
                : undefined
            }
          >
            {video.webmUrl ? (
              <source src={video.webmUrl} type="video/webm" />
            ) : null}
            <source src={video.url} type="video/mp4" />
          </video>
          {pause ? (
            // The name says what pressing does, so it changes with the state.
            <button
              type="button"
              onClick={toggle}
              aria-label={
                pause.icons
                  ? isPaused
                    ? pause.playLabel
                    : pause.pauseLabel
                  : undefined
              }
              className={pause.className}
            >
              {pause.icons
                ? isPaused
                  ? pause.icons.play
                  : pause.icons.pause
                : isPaused
                  ? pause.playLabel
                  : pause.pauseLabel}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
