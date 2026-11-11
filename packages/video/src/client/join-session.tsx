"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { ElevaCall, type ElevaCallRecords } from "./eleva-call"
import type { CallWindow } from "./overtime-notice"
import {
  joinErrorCode,
  joinErrorWindow,
  type ElevaCallErrorCode,
  type ElevaCallLabels,
} from "./labels"
import {
  readJoinWindow,
  retryableJoinFailure,
  type JoinWindow,
  type OpenAttempt,
} from "../waiting-room"
import { SessionClosed, SupportLine, WaitingRoom } from "./waiting-room"

export type JoinSessionProps = {
  join: () => Promise<{
    roomUrl: string
    token: string
    endsAt: string
    expiresAt: string
    transcriptionAllowed: boolean
    sessionLanguage?: string | null
  }>
  labels: ElevaCallLabels
  backHref: string
  showNotesSlot?: boolean
  records?: ElevaCallRecords
  /**
   * Shown under the waiting room and the "could not join" message, never
   * during the call (members: where to get urgent help).
   */
  aside?: ReactNode
  /** Guests: no back button while waiting; the logo already links home. */
  showBackWhileWaiting?: boolean
}

type JoinResult = Awaited<ReturnType<JoinSessionProps["join"]>>

export function JoinSession({
  join,
  labels,
  backHref,
  showNotesSlot = false,
  records,
  aside,
  showBackWhileWaiting = true,
}: JoinSessionProps) {
  const [creds, setCreds] = useState<{
    roomUrl: string
    token: string
    callWindow: CallWindow
    transcriptionAllowed: boolean
    sessionLanguage: string | null
  } | null>(null)
  const [error, setError] = useState<ElevaCallErrorCode | null>(null)
  const [windowHint, setWindowHint] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<JoinWindow | null>(null)
  const [loading, setLoading] = useState(true)
  /** When the person left the call (device clock), or `null`. */
  const [leftAt, setLeftAt] = useState<number | null>(null)
  const left = leftAt !== null
  /** The call opened from the waiting room: say so and move focus to it. */
  const [openedFromWaiting, setOpenedFromWaiting] = useState(false)
  /** The person asked to come back in: focus follows them into the call. */
  const [rejoined, setRejoined] = useState(false)
  const callRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  const enter = useCallback((result: JoinResult) => {
    setCreds({
      roomUrl: result.roomUrl,
      token: result.token,
      callWindow: { endsAt: result.endsAt, closesAt: result.expiresAt },
      transcriptionAllowed: result.transcriptionAllowed,
      sessionLanguage: result.sessionLanguage ?? null,
    })
    setWaiting(null)
    setError(null)
    setLoading(false)
  }, [])

  /** Record why joining failed; a session that is not open yet waits. */
  const refuse = useCallback((err: unknown): ElevaCallErrorCode => {
    const code = joinErrorCode(err)
    const details = code === "SESSION_NOT_OPEN" ? joinErrorWindow(err) : {}
    setWaiting(
      code === "SESSION_NOT_OPEN" ? readJoinWindow(details, Date.now()) : null
    )
    setWindowHint(details.startsAt ? formatJoinStart(details.startsAt) : null)
    setError(code)
    setLoading(false)
    return code
  }, [])

  const load = useCallback(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    setWindowHint(null)
    setWaiting(null)
    setCreds(null)
    void join()
      .then((result) => {
        if (id === reqId.current) enter(result)
      })
      .catch((err: unknown) => {
        if (id === reqId.current) refuse(err)
      })
  }, [join, enter, refuse])

  /** One quiet try from the waiting room, which stays on screen meanwhile. */
  const tryOpen = useCallback(async (): Promise<OpenAttempt> => {
    const id = ++reqId.current
    try {
      const result = await join()
      if (id !== reqId.current) return "joined"
      // The page was put away while asking: the camera check never opens
      // unseen. The waiting room asks again when the person is back.
      if (document.visibilityState === "hidden") return "failed"
      setOpenedFromWaiting(true)
      enter(result)
      return "joined"
    } catch (err) {
      if (id !== reqId.current) return "failed"
      const code = joinErrorCode(err)
      // The room is made as the session opens: keep waiting and ask again.
      if (code === "ROOM_NOT_READY") return "not_open"
      if (code === "internal") {
        // A dropped connection or a busy server usually clears within the
        // next pause. Anything else the server said is final.
        const status = (err as { status?: unknown } | null)?.status
        const verdict = retryableJoinFailure(
          typeof status === "number" ? status : undefined
        )
        if (verdict === "retry") return "failed"
        if (verdict === "rate_limited") return "rate_limited"
      }
      // Final, or it re-times the wait (SESSION_NOT_OPEN).
      return refuse(err) === "SESSION_NOT_OPEN" ? "not_open" : "failed"
    }
  }, [join, enter, refuse])

  useEffect(() => {
    return () => {
      reqId.current += 1
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Someone waiting may be looking elsewhere when the call opens: move
  // focus to it, and let the tab title say so until they leave the page.
  const opened = openedFromWaiting && Boolean(creds) && !left
  const focusCall = (opened || rejoined) && Boolean(creds) && !left
  useEffect(() => {
    if (focusCall) callRef.current?.focus()
  }, [focusCall])
  useEffect(() => {
    if (!opened) return
    const previous = document.title
    document.title = labels.waitingRoomOpened
    return () => {
      document.title = previous
    }
  }, [opened, labels.waitingRoomOpened])

  if (left) {
    // Joining stays open until the token's end: someone who left by
    // mistake, or found nobody yet, can come straight back.
    const closesAt = creds ? Date.parse(creds.callWindow.closesAt) : Number.NaN
    const canRejoin = Number.isFinite(closesAt) && closesAt > leftAt
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-12 text-center">
        <h1 className="text-xl font-medium">{labels.leftTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.leftBody}</p>
        {canRejoin ? (
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {labels.leftRejoinHint(formatClock(closesAt, labels.timeLocale))}
          </p>
        ) : null}
        <SupportLine
          labels={labels}
          className="text-sm text-pretty text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">{labels.callPrivacy}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {canRejoin ? (
            <Button
              onPress={() => {
                setLeftAt(null)
                setOpenedFromWaiting(false)
                setRejoined(true)
                load()
              }}
            >
              {labels.rejoin}
            </Button>
          ) : null}
          <LinkButton
            variant={canRejoin ? "outline" : "default"}
            href={backHref}
          >
            {labels.back}
          </LinkButton>
        </div>
        {aside ? <div className="text-left">{aside}</div> : null}
      </div>
    )
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {labels.connecting}
      </p>
    )
  }

  if (waiting) {
    return (
      <WaitingRoom
        // A new opening time (a reschedule) starts a fresh wait.
        key={waiting.opensAt}
        window={waiting}
        labels={labels}
        backHref={backHref}
        showBack={showBackWhileWaiting}
        onOpen={tryOpen}
        aside={aside}
      />
    )
  }

  // Over or not active: asking again cannot help, so no "try again".
  if (error === "SESSION_ENDED" || error === "SESSION_NOT_ACTIVE") {
    return (
      <SessionClosed
        kind={error === "SESSION_ENDED" ? "ended" : "not_active"}
        labels={labels}
        backHref={backHref}
        aside={aside}
      />
    )
  }

  if (error || !creds) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 py-12">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-medium">{labels.errorTitle}</h1>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {sessionNotOpenCopy(
              labels.errors[error ?? "internal"],
              error === "SESSION_NOT_OPEN" ? windowHint : null
            )}
          </p>
          <SupportLine
            labels={labels}
            className="text-sm text-pretty text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">{labels.callPrivacy}</p>
          <div className="flex flex-wrap gap-2">
            <Button onPress={load}>{labels.retry}</Button>
            <LinkButton variant="outline" href={backHref}>
              {labels.back}
            </LinkButton>
          </div>
        </div>
        {aside}
      </div>
    )
  }

  return (
    <div
      ref={callRef}
      tabIndex={-1}
      role="group"
      aria-label={opened ? labels.waitingRoomOpened : undefined}
      className="outline-none"
    >
      <p role="status" className="sr-only">
        {opened ? labels.waitingRoomOpened : null}
      </p>
      <ElevaCall
        roomUrl={creds.roomUrl}
        token={creds.token}
        labels={labels}
        showNotesSlot={showNotesSlot}
        records={records}
        backHref={backHref}
        callWindow={creds.callWindow}
        transcriptionAllowed={creds.transcriptionAllowed}
        sessionLanguage={creds.sessionLanguage}
        onLeft={() => setLeftAt(Date.now())}
      />
    </div>
  )
}

function sessionNotOpenCopy(template: string, start: string | null): string {
  if (!start) return template
  if (template.includes("{start}")) return template.replace("{start}", start)
  return `${template.replace(/\.$/, "")}: ${start}.`
}

function formatClock(time: number, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time))
}

function formatJoinStart(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}
