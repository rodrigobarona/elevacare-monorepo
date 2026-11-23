"use client"

import { useState } from "react"
import type { Locale } from "@eleva/config/i18n-locales"
import { PauseIcon, PlayIcon } from "@eleva/icons"
import { ElevaVideo } from "@eleva/media/video"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { cn } from "@eleva/ui/lib/utils"
import { Link } from "@/i18n/navigation"

/**
 * The homepage hero: the film, one question, one line and one action.
 *
 * Only the question changes, scene by scene, so the words match the picture.
 * It is hidden from assistive technology: the page heading is fixed, the
 * same questions are links in the next section, and the line and the action
 * never change, so nobody presses a different link from the one she read.
 * Phones and visitors who ask for reduced motion get the poster and the
 * opening question.
 *
 * The words sit on the film itself. A feathered dark grade and an edgeless
 * blur behind them keep them readable on every scene; there is no panel.
 */
export function HomeHero({
  locale,
  heading,
  lead,
  action,
  scenes,
  pauseLabel,
  playLabel,
  note,
}: {
  locale: Locale
  /** The page heading and the opening question. */
  heading: string
  lead: string
  action: string
  /** Scene start in seconds and the question shown from then on. */
  scenes: readonly { from: number; text: string }[]
  pauseLabel: string
  playLabel: string
  /** A quiet note in the corner of the film, e.g. who appears in it. */
  note: string
}) {
  const [question, setQuestion] = useState(heading)

  function follow(seconds: number) {
    // The words change a moment after the picture has.
    const at = seconds - 0.3
    let next = heading
    for (const scene of scenes) {
      if (scene.from <= at) next = scene.text
    }
    setQuestion(next)
  }

  return (
    <section className="group/hero relative isolate mx-2 flex min-h-[min(78svh,46rem)] flex-col justify-end overflow-hidden rounded-3xl bg-teal-950 text-white sm:mx-3">
      <div className="relative max-w-3xl px-6 pt-40 pb-8 sm:px-10 sm:pb-12 lg:px-14 lg:pb-14">
        <h1 className="sr-only" data-testid="marketing-hero">
          {heading}
        </h1>
        <p
          aria-hidden
          className="flex min-h-[2.2em] items-end font-display text-4xl leading-[1.08] tracking-tight text-balance text-shadow-lg sm:text-5xl"
        >
          <span
            key={question}
            className="motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          >
            {question}
          </span>
        </p>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-pretty text-white/95 text-shadow-sm sm:text-xl">
          {lead}
        </p>
        <Link
          href="/experts"
          className={cn(
            buttonVariants({ variant: "inverse", size: "xl" }),
            "mt-7 w-full sm:w-auto"
          )}
        >
          {action}
        </Link>
      </div>

      {/* After the action in the page, so the pause button follows it for a
          keyboard. */}
      <ElevaVideo
        slug="hero-intro"
        locale={locale}
        sizes="100vw"
        priority
        className="absolute inset-0 -z-20"
        onTime={follow}
        pause={{
          pauseLabel,
          playLabel,
          icons: {
            pause: <PauseIcon aria-hidden weight="fill" className="size-4" />,
            play: <PlayIcon aria-hidden weight="fill" className="size-4" />,
          },
          className:
            "absolute right-3 bottom-3 grid size-10 cursor-pointer place-content-center rounded-full bg-teal-950/45 text-white backdrop-blur-md transition-colors hover:bg-teal-950/70 sm:right-5 sm:bottom-5",
        }}
      />
      {/* The grade: dark where the words sit, clear where the faces are. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(4_26_30/0.9)_0%,rgb(4_26_30/0.72)_38%,rgb(4_26_30/0)_78%)] lg:bg-[radial-gradient(ellipse_105%_120%_at_0%_100%,rgb(4_26_30/0.9)_0%,rgb(4_26_30/0.74)_42%,rgb(4_26_30/0)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_top,black_30%,transparent_70%)] backdrop-blur-md lg:[mask-image:radial-gradient(ellipse_70%_85%_at_0%_100%,black_30%,transparent_78%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(4_26_30/0.5)_0%,rgb(4_26_30/0)_16%)] sm:bg-[linear-gradient(to_top,rgb(4_26_30/0.72)_0%,rgb(4_26_30/0)_20%)]"
      />
      {/* A note, not an action: small and quiet, in the corner of the
          picture, beside the pause button when the film runs. */}
      <p className="pointer-events-none absolute top-3 right-4 flex h-10 items-center text-xs text-white/80 text-shadow-sm sm:top-auto sm:right-5 sm:bottom-5 group-has-[video]/hero:sm:right-[4.5rem]">
        {note}
      </p>
    </section>
  )
}
