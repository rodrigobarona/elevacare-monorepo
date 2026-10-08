"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button, buttonVariants } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { isJoinCtaEnabled } from "./join-window"

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
  joinSoonLabel: string
  className?: string
  /** Disabled Join button, or muted copy when the window is closed. */
  pending?: "button" | "hint"
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
  className,
  pending = "button",
  icon,
}: JoinCtaProps) {
  const now = useJoinCtaClock()
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

  if (pending === "hint") {
    if (sessionMode !== "online") return null
    return (
      <p className={cn("mt-4 text-xs text-muted-foreground", className)}>
        {joinSoonLabel}
      </p>
    )
  }

  return (
    <Button isDisabled aria-label={joinSoonLabel} className={className}>
      {icon}
      {joinLabel}
    </Button>
  )
}
