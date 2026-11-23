"use client"

import { useEffect, useRef, useState } from "react"

/**
 * The hero's one moving idea: a question a woman might bring, and the one
 * action that answers it. Each question belongs to one clip of the film and
 * changes with it, so the words always match the picture. Without the film
 * (phones, reduced motion) or while it is paused, the question stays.
 */
const CLIP_SECONDS = 3.8
const QUESTIONS = [
  {
    ask: "Is it normal to leak when I run?",
    action: "See pelvic health physiotherapists",
  },
  {
    ask: "How do I write a birth plan I understand?",
    action: "See midwives",
  },
  {
    ask: "Is my baby getting enough milk?",
    action: "See breastfeeding consultants",
  },
  {
    ask: "What should I eat while we are trying?",
    action: "See fertility nutritionists",
  },
  {
    ask: "Why am I awake at three again?",
    action: "See doctors who work with menopause",
  },
  {
    ask: "Who do I even ask about this?",
    action: "See all experts",
  },
] as const

export function HeroQuestions() {
  const root = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const hero = root.current?.parentElement
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
      <h1 key={current.ask}>{current.ask}</h1>
      <p>
        Ask someone who knows. Book a registered women&apos;s health expert, by
        video, phone or in person.
      </p>
      <a href="#experts" className="bl-btn" key={current.action}>
        {current.action}
      </a>
    </div>
  )
}
