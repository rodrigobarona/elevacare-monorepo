"use client"

import { useRef, useState, useSyncExternalStore } from "react"

const FILM = "/brand-lab/film"
const AMBIENT =
  "(prefers-reduced-motion: no-preference) and (min-width: 1024px)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(AMBIENT)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * The hero film: a silent 23-second loop over its poster. Phones and anyone
 * who asks for reduced motion get the poster only and never download the
 * video (the same rule as `ElevaVideo` in `@eleva/media`). The film can be
 * paused, because it moves for longer than five seconds.
 */
export function HeroFilm({ className = "es-film" }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const ambient = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(AMBIENT).matches,
    () => false
  )

  function toggle() {
    const element = video.current
    if (!element) return
    if (element.paused) {
      void element.play()
      setPaused(false)
    } else {
      element.pause()
      setPaused(true)
    }
  }

  return (
    <div className={`bl-film ${className}`}>
      <img src={`${FILM}/poster.jpg`} alt="" />
      {ambient ? (
        <>
          <video
            ref={video}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            tabIndex={-1}
            poster={`${FILM}/poster.jpg`}
          >
            <source src={`${FILM}/hero.webm`} type="video/webm" />
            <source src={`${FILM}/hero.mp4`} type="video/mp4" />
          </video>
          <button type="button" onClick={toggle} aria-pressed={paused}>
            {paused ? "Play film" : "Pause film"}
          </button>
        </>
      ) : null}
    </div>
  )
}
