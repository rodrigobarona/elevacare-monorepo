"use client"

import { useEffect, useRef, useState } from "react"

/**
 * The hero's one moving idea: a question a woman might bring. Each question
 * belongs to one clip of the film and changes with it, so the words match the
 * picture. Only the question moves, and it is hidden from assistive
 * technology: the heading a screen reader gets is fixed, and the line under
 * it and the one action never change, so nobody presses a
 * different link from the one she read (the third blind panel's first
 * blocking finding). Without the film (phones, reduced motion) or while it is
 * paused, the first question stays.
 */
const CLIP_SECONDS = 3.8
/** In the film's order. The first is also the still, so it has to fit any visitor. */
const QUESTIONS = [
  "Who do I even ask about this?",
  "What goes in a birth plan?",
  "Is my baby getting enough milk?",
  "What should I eat while trying for a baby?",
  "Why am I awake at three again?",
  "Is it normal to leak when I laugh?",
] as const

export function HeroQuestions() {
  const root = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const hero = root.current?.closest(".vo-hero")
    if (!hero) return
    let video: HTMLVideoElement | null = null
    const onTime = () => {
      if (!video) return
      // The words change a moment after the picture has.
      const clip = Math.floor(
        Math.max(0, video.currentTime - 0.3) / CLIP_SECONDS
      )
      setIndex(clip % QUESTIONS.length)
    }
    const attach = () => {
      const found = hero.querySelector("video")
      if (found === video) return
      video?.removeEventListener("timeupdate", onTime)
      video = found
      video?.addEventListener("timeupdate", onTime)
      if (!video) setIndex(0)
    }
    attach()
    // The film mounts and unmounts with the viewport and the motion setting.
    const observer = new MutationObserver(attach)
    observer.observe(hero, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      video?.removeEventListener("timeupdate", onTime)
    }
  }, [])

  const current = QUESTIONS[index] ?? QUESTIONS[0]

  return (
    <div className="vo-ask" ref={root}>
      <h1 className="vo-sr">{QUESTIONS[0]}</h1>
      <p className="vo-q" aria-hidden>
        <span key={current}>{current}</span>
      </p>
      <p className="vo-lead">
        Ask someone who knows. Book a registered women&apos;s health expert, by
        video, phone or in person.
      </p>
      <a href="#experts" className="bl-btn">
        See the experts
      </a>
    </div>
  )
}
