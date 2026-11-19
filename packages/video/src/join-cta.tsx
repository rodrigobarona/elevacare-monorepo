"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { Button, buttonVariants } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { isJoinCtaEnabled, isJoinStillAhead } from "./join-window"

const JOIN_CTA_TICK_MS = 30_000

export function useJoinCtaClock(intervalMs = JOIN_CTA_TICK_MS): Date | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now === null ? null : new Date(now)
}

export type JoinCtaProps = {
  href: string
  sessionMode: string
  status: string
  startsAt: Date | string
  endsAt: Date | string
  joinLabel: string
  /** When joining opens, in words. Describes the waiting button. */
  joinSoonLabel: string
  /**
   * Id of visible text that already says when joining opens (see
   * `JoinPendingHint`). Without it the button carries the sentence itself,
   * for screen readers only.
   */
  describedBy?: string
  className?: string
  /**
   * Before joining opens: a disabled Join button, muted copy, or nothing.
   * Only ever for a video session that can still be joined; a session that
   * is in person, by phone, over, cancelled or unconfirmed shows nothing.
   */
  pending?: "button" | "hint" | "none"
  icon?: ReactNode
}

export function JoinCta({
  href,
  sessionMode,
  status,
  startsAt,
  endsAt,
  joinLabel,
  joinSoonLabel,
  describedBy,
  className,
  pending = "button",
  icon,
}: JoinCtaProps) {
  const now = useJoinCtaClock()
  const hintId = useId()
  const enabled =
    now !== null &&
    isJoinCtaEnabled({
      sessionMode,
      status,
      startsAt,
      endsAt,
      now,
    })

  if (enabled) {
    return (
      <a
        href={href}
        className={cn(buttonVariants(), className)}
        data-join-cta="document"
      >
        {icon}
        {joinLabel}
      </a>
    )
  }

  if (pending === "none") return null
  // Before the first tick the time is not known: hold the button's place
  // for a session that could be joined, and show nothing for the rest.
  const ahead = isJoinStillAhead({
    sessionMode,
    status,
    startsAt,
    now: now ?? new Date(0),
  })
  if (!ahead) return null

  if (pending === "hint") {
    if (now === null) return null
    return (
      <p className={cn("mt-4 text-xs text-muted-foreground", className)}>
        {joinSoonLabel}
      </p>
    )
  }

  return (
    <>
      <Button
        isDisabled
        aria-describedby={describedBy ?? hintId}
        className={className}
      >
        {icon}
        {joinLabel}
      </Button>
      {describedBy ? null : (
        <span id={hintId} className="sr-only">
          {joinSoonLabel}
        </span>
      )}
    </>
  )
}

/**
 * The line beside a waiting Join button: when joining opens. It is there
 * only while the button waits, and goes once joining has opened.
 */
export function JoinPendingHint({
  sessionMode,
  status,
  startsAt,
  id,
  className,
  children,
}: {
  sessionMode: string
  status: string
  startsAt: Date | string
  id?: string
  className?: string
  children: ReactNode
}) {
  const now = useJoinCtaClock()
  // Before the first tick the time is not known: keep the line, as the
  // button keeps its place.
  const waiting = isJoinStillAhead({
    sessionMode,
    status,
    startsAt,
    now: now ?? new Date(0),
  })
  if (!waiting) return null
  return (
    <p id={id} className={className}>
      {children}
    </p>
  )
}
