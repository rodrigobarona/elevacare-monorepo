"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ClockIcon, InfoIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  AUTO_JOIN_PAUSES_MS,
  attemptsAfter,
  autoJoinDelay,
  minutesUntilOpen,
  opensAnotherDay,
  waitingPhase,
  type JoinWindow,
  type OpenAttempt,
} from "../waiting-room"
import type { ElevaCallLabels } from "./labels"

type ClosedLabels = Pick<
  ElevaCallLabels,
  | "back"
  | "endedTitle"
  | "endedBody"
  | "notActiveTitle"
  | "notActiveBody"
  | "closedHelp"
  | "supportEmail"
>

type WaitingRoomLabels = ClosedLabels &
  Pick<
    ElevaCallLabels,
    | "retry"
    | "timeLocale"
    | "waitingRoomTitle"
    | "waitingRoomTitleLater"
    | "waitingRoomJoinFrom"
    | "waitingRoomKeepOpen"
    | "waitingRoomComeBack"
    | "waitingRoomCountdown"
    | "waitingRoomSoon"
    | "waitingRoomOpening"
    | "waitingRoomOpened"
    | "waitingRoomTip"
    | "waitingRoomPrivacy"
    | "waitingRoomManual"
  >

const CARD =
  "max-w-lg rounded-3xl border bg-card p-6 text-card-foreground shadow-1 sm:p-8"
const CHIP =
  "flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
const TITLE =
  "mt-4 font-display text-2xl font-medium tracking-tight text-balance"

/** Minutes left at which a screen reader is told how long is left. */
const SPOKEN_MINUTES = new Set([15, 10, 5])

/**
 * A session nobody can join any more: it ended, or it is not active (for
 * example cancelled). No "try again": asking again cannot help. It says
 * where to write instead.
 */
function SupportLine({
  labels,
  className,
}: {
  labels: Pick<ElevaCallLabels, "closedHelp" | "supportEmail">
  className?: string
}) {
  const [before, after] = labels
    .closedHelp(labels.supportEmail)
    .split(labels.supportEmail)
  return (
    <p className={className}>
      {before}
      <a
        href={`mailto:${labels.supportEmail}`}
        className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground"
      >
        {labels.supportEmail}
      </a>
      {after}
    </p>
  )
}

export function SessionClosed({
  kind,
  labels,
  backHref,
  aside,
}: {
  kind: "ended" | "not_active"
  labels: ClosedLabels
  backHref: string
  /** Shown under the card (members: where to get urgent help). */
  aside?: ReactNode
}) {
  const titleId = useId()
  const ended = kind === "ended"
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <section
        aria-labelledby={titleId}
        data-testid="session-closed"
        data-kind={kind}
        className={CARD}
      >
        <span aria-hidden className={CHIP}>
          {ended ? (
            <ClockIcon className="size-5" />
          ) : (
            <InfoIcon className="size-5" />
          )}
        </span>
        <h2 id={titleId} className={TITLE}>
          {ended ? labels.endedTitle : labels.notActiveTitle}
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          {ended ? labels.endedBody : labels.notActiveBody}
        </p>
        <SupportLine
          labels={labels}
          className="mt-4 text-sm text-pretty text-muted-foreground"
        />
        <div className="mt-6">
          <LinkButton href={backHref}>{labels.back}</LinkButton>
        </div>
      </section>
      {aside}
    </div>
  )
}

function isPageVisible(): boolean {
  return (
    typeof document === "undefined" || document.visibilityState !== "hidden"
  )
}

/**
 * The join page before joining opens: when the session starts, when the
 * person can join, a countdown on the server's clock, and the camera check
 * opening by itself once joining opens. If the page is left open until
 * joining has closed, it says the session has ended.
 */
export function WaitingRoom({
  window: joinWindow,
  labels,
  backHref,
  showBack = true,
  onOpen,
  aside,
}: {
  window: JoinWindow
  labels: WaitingRoomLabels
  backHref: string
  /** Hide the back button while waiting (guests: the logo links home). */
  showBack?: boolean
  /** Ask the API once; resolves with what it found. */
  onOpen: () => Promise<OpenAttempt>
  /** Shown under the card while the session is still ahead. */
  aside?: ReactNode
}) {
  const titleId = useId()
  const [now, setNow] = useState(() => Date.now())
  const [visible, setVisible] = useState(isPageVisible)
  const [attempt, setAttempt] = useState(0)
  const [asking, setAsking] = useState(false)
  // Drawn once: a new draw on every tick would keep moving the first try.
  const [spread] = useState(() => Math.random())
  const askingRef = useRef(false)
  const mounted = useRef(true)
  const onOpenRef = useRef(onOpen)
  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const phase = waitingPhase(joinWindow, now)

  useEffect(() => {
    if (phase === "ended") return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    // Browsers slow timers in a background tab: catch up when it returns.
    const sync = () => {
      setVisible(isPageVisible())
      setNow(Date.now())
    }
    document.addEventListener("visibilitychange", sync)
    window.addEventListener("focus", sync)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", sync)
      window.removeEventListener("focus", sync)
    }
  }, [phase])

  const runTry = useCallback(() => {
    if (askingRef.current) return
    askingRef.current = true
    setAsking(true)
    void onOpenRef
      .current()
      .catch((): OpenAttempt => "failed")
      .then((result) => {
        askingRef.current = false
        if (!mounted.current || result === "joined") return
        setAttempt((current) => attemptsAfter(result, current))
        setAsking(false)
      })
  }, [])

  const opening = phase === "opening"
  // Only with the page in view: opening shows the camera check, which
  // turns the camera preview on, and that should never happen unattended.
  const pause =
    opening && visible && !asking ? autoJoinDelay(attempt, spread) : null
  useEffect(() => {
    if (pause === null) return
    const timer = setTimeout(runTry, pause)
    return () => clearTimeout(timer)
    // `attempt` restarts the timer when two tries share a pause.
  }, [pause, attempt, runTry])

  const { time, dateTime } = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(labels.timeLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      dateTime: new Intl.DateTimeFormat(labels.timeLocale, {
        dateStyle: "full",
        timeStyle: "short",
      }),
    }),
    [labels.timeLocale]
  )

  const minutes = minutesUntilOpen(joinWindow, now)
  const gaveUp = opening && attempt >= AUTO_JOIN_PAUSES_MS.length
  const countdown = opening
    ? asking || !gaveUp
      ? visible
        ? labels.waitingRoomOpening
        : labels.waitingRoomOpened
      : labels.waitingRoomManual
    : minutes <= 1
      ? labels.waitingRoomSoon
      : minutes <= 60
        ? labels.waitingRoomCountdown(minutes)
        : null

  // The tab title follows the wait, so it can be read from another tab.
  const tabTitle =
    phase === "ended" ? null : opening ? labels.waitingRoomOpened : countdown
  useEffect(() => {
    if (!tabTitle) return
    const previous = document.title
    document.title = tabTitle
    return () => {
      document.title = previous
    }
  }, [tabTitle])

  if (phase === "ended") {
    return (
      <SessionClosed
        kind="ended"
        labels={labels}
        backHref={backHref}
        aside={aside}
      />
    )
  }

  const starts = new Date(joinWindow.startsAt)
  const anotherDay = opensAnotherDay(joinWindow, now)
  const title = anotherDay
    ? labels.waitingRoomTitleLater(dateTime.format(starts))
    : labels.waitingRoomTitle(time.format(starts))
  // Spoken at a few moments only, so the countdown does not interrupt.
  const spoken =
    opening || minutes <= 1 || SPOKEN_MINUTES.has(minutes) ? countdown : null

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <section
        aria-labelledby={titleId}
        data-testid="waiting-room"
        data-phase={phase}
        className={CARD}
      >
        <span aria-hidden className={CHIP}>
          <ClockIcon className="size-5" />
        </span>
        <h2 id={titleId} className={TITLE}>
          {title}
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          {labels.waitingRoomJoinFrom(
            time.format(new Date(joinWindow.opensAt))
          )}
        </p>
        {countdown ? (
          <p
            role="timer"
            aria-live="off"
            data-testid="waiting-room-countdown"
            className="mt-6 flex items-center gap-2 text-lg font-medium tabular-nums"
          >
            {opening && !gaveUp ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
              />
            ) : null}
            {countdown}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {spoken}
        </p>
        {gaveUp ? (
          <>
            <div className="mt-4">
              <Button onPress={runTry}>{labels.retry}</Button>
            </div>
            <SupportLine
              labels={labels}
              className="mt-4 text-sm text-pretty text-muted-foreground"
            />
          </>
        ) : null}
        <p className="mt-6 text-sm text-pretty text-muted-foreground">
          {minutes > 60
            ? labels.waitingRoomComeBack
            : labels.waitingRoomKeepOpen}
        </p>
        {minutes > 60 ? null : (
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            {labels.waitingRoomTip}
          </p>
        )}
        <p className="mt-2 text-xs text-pretty text-muted-foreground">
          {labels.waitingRoomPrivacy}
        </p>
        {showBack ? (
          <div className="mt-6">
            <LinkButton variant="outline" href={backHref}>
              {labels.back}
            </LinkButton>
          </div>
        ) : null}
      </section>
      {aside}
    </div>
  )
}
