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
import { readJoinWindow, type JoinWindow } from "../waiting-room"
import { SessionClosed, WaitingRoom, type OpenAttempt } from "./waiting-room"

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
  const [left, setLeft] = useState(false)
  /** The call opened from the waiting room: say so and move focus to it. */
  const [openedFromWaiting, setOpenedFromWaiting] = useState(false)
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
      if (id === reqId.current) {
        setOpenedFromWaiting(true)
        enter(result)
      }
      return "joined"
    } catch (err) {
      if (id !== reqId.current) return "failed"
      const code = joinErrorCode(err)
      // Keep waiting and ask again: the room is made as the session opens
      // (ROOM_NOT_READY), and a dropped connection, a busy server or a
      // rate limit (internal) usually clears within the next pause.
      if (code === "ROOM_NOT_READY") return "not_open"
      if (code === "internal") return "failed"
      // Anything else is final, or re-times the wait (SESSION_NOT_OPEN).
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
  useEffect(() => {
    if (!opened) return
    callRef.current?.focus()
    const previous = document.title
    document.title = labels.waitingRoomOpened
    return () => {
      document.title = previous
    }
  }, [opened, labels.waitingRoomOpened])

  if (left) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-12 text-center">
        <h1 className="text-xl font-medium">{labels.leftTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.leftBody}</p>
        <p className="text-xs text-muted-foreground">{labels.callPrivacy}</p>
        <LinkButton href={backHref}>{labels.back}</LinkButton>
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
    <div ref={callRef} tabIndex={-1} className="outline-none">
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
        onLeft={() => setLeft(true)}
      />
    </div>
  )
}

function sessionNotOpenCopy(template: string, start: string | null): string {
  if (!start) return template
  if (template.includes("{start}")) return template.replace("{start}", start)
  return `${template.replace(/\.$/, "")}: ${start}.`
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
