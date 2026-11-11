"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ClockIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  autoJoinDelay,
  minutesUntilOpen,
  opensAnotherDay,
  waitingPhase,
  type JoinWindow,
} from "../waiting-room"
import type { ElevaCallLabels } from "./labels"

/** What one automatic try found. */
export type OpenAttempt = "joined" | "not_open" | "failed"

type WaitingRoomLabels = Pick<
  ElevaCallLabels,
  | "back"
  | "callPrivacy"
  | "retry"
  | "timeLocale"
  | "waitingRoomTitle"
  | "waitingRoomTitleLater"
  | "waitingRoomStarts"
  | "waitingRoomKeepOpen"
  | "waitingRoomCountdown"
  | "waitingRoomSoon"
  | "waitingRoomOpening"
  | "waitingRoomTip"
  | "waitingRoomManual"
  | "endedTitle"
  | "endedBody"
>

/** Minutes left at which a screen reader is told how long is left. */
const SPOKEN_MINUTES = new Set([15, 10, 5, 1])

/**
 * The join page before joining opens: when the session opens and starts,
 * a countdown on the server's clock, and the call opening by itself. Once
 * joining has closed it says the session has ended.
 */
export function WaitingRoom({
  window: joinWindow,
  labels,
  backHref,
  onOpen,
  aside,
}: {
  window: JoinWindow
  labels: WaitingRoomLabels
  backHref: string
  /** Ask the API once; resolves with what it found. */
  onOpen: () => Promise<OpenAttempt>
  /** Shown under the card while the session is still ahead. */
  aside?: ReactNode
}) {
  const titleId = useId()
  const [now, setNow] = useState(() => Date.now())
  const [attempt, setAttempt] = useState(0)
  const [asking, setAsking] = useState(false)
  const onOpenRef = useRef(onOpen)
  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])

  const phase = waitingPhase(joinWindow, now)
  const opening = phase === "opening"
  const pause = opening && !asking ? autoJoinDelay(attempt) : null

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (pause === null) return
    // Clearing the timer is enough: once a try has started, its answer is
    // still handled (asking turns `pause` to null and re-runs this effect).
    const timer = setTimeout(() => {
      setAsking(true)
      void onOpenRef.current().then((result) => {
        if (!mounted.current || result === "joined") return
        setAttempt((current) => current + 1)
        setAsking(false)
      })
    }, pause)
    return () => clearTimeout(timer)
    // `attempt` restarts the timer after each answer; `pause` alone would
    // not change between two tries that share a pause.
  }, [pause, attempt])

  const time = new Intl.DateTimeFormat(labels.timeLocale, {
    hour: "2-digit",
    minute: "2-digit",
  })
  const dateTime = new Intl.DateTimeFormat(labels.timeLocale, {
    dateStyle: "full",
    timeStyle: "short",
  })

  if (phase === "ended") {
    return (
      <section
        aria-labelledby={titleId}
        data-testid="waiting-room"
        data-phase="ended"
        className="mx-auto max-w-lg rounded-3xl border bg-card p-6 text-card-foreground shadow-1 sm:p-8"
      >
        <h2
          id={titleId}
          className="font-display text-2xl font-medium tracking-tight text-balance"
        >
          {labels.endedTitle}
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          {labels.endedBody}
        </p>
        <div className="mt-6">
          <LinkButton href={backHref}>{labels.back}</LinkButton>
        </div>
      </section>
    )
  }

  const minutes = minutesUntilOpen(joinWindow, now)
  const opens = new Date(joinWindow.opensAt)
  const title = opensAnotherDay(joinWindow, now)
    ? labels.waitingRoomTitleLater(dateTime.format(opens))
    : labels.waitingRoomTitle(time.format(opens))
  const gaveUp = opening && !asking && autoJoinDelay(attempt) === null
  const countdown = opening
    ? gaveUp
      ? labels.waitingRoomManual
      : labels.waitingRoomOpening
    : minutes <= 1
      ? labels.waitingRoomSoon
      : minutes <= 60
        ? labels.waitingRoomCountdown(minutes)
        : null
  // Spoken at a few moments only, so the countdown does not interrupt.
  const spoken =
    opening || (minutes > 0 && SPOKEN_MINUTES.has(minutes)) ? countdown : null

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <section
        aria-labelledby={titleId}
        data-testid="waiting-room"
        data-phase={phase}
        className="rounded-3xl border bg-card p-6 text-card-foreground shadow-1 sm:p-8"
      >
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <ClockIcon className="size-5" />
        </span>
        <h2
          id={titleId}
          className="mt-4 font-display text-2xl font-medium tracking-tight text-balance first-letter:uppercase"
        >
          {title}
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          {labels.waitingRoomStarts(time.format(new Date(joinWindow.startsAt)))}{" "}
          {labels.waitingRoomKeepOpen}
        </p>
        {countdown ? (
          <p
            role="timer"
            aria-live="off"
            data-testid="waiting-room-countdown"
            className="mt-6 text-lg font-medium tabular-nums"
          >
            {countdown}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {spoken}
        </p>
        {gaveUp ? (
          <div className="mt-4">
            <Button
              onPress={() => {
                setAttempt(0)
              }}
            >
              {labels.retry}
            </Button>
          </div>
        ) : null}
        <p className="mt-6 text-sm text-pretty text-muted-foreground">
          {labels.waitingRoomTip}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {labels.callPrivacy}
        </p>
        <div className="mt-6">
          <LinkButton variant="outline" href={backHref}>
            {labels.back}
          </LinkButton>
        </div>
      </section>
      {aside}
    </div>
  )
}
