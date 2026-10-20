"use client"

import { useEffect, useState } from "react"
import { isOvertime } from "../join-window"
import type { ElevaCallLabels } from "./labels"

export type CallWindow = {
  /** Booked end (ISO). */
  endsAt: string
  /** Meeting token expiry (ISO); the room closes for this person here. */
  closesAt: string
}

/** setTimeout clamps delays above 2^31-1 ms to 0. */
const MAX_TIMEOUT_MS = 2_147_483_647

export function OvertimeNotice({
  window: callWindow,
  labels,
}: {
  window: CallWindow
  labels: Pick<ElevaCallLabels, "overtimeTitle" | "overtimeBody">
}) {
  const { endsAt, closesAt } = callWindow
  const [overtime, setOvertime] = useState(() => isOvertime(endsAt, Date.now()))

  useEffect(() => {
    if (overtime) return
    const delay = Date.parse(endsAt) - Date.now()
    if (!Number.isFinite(delay) || delay > MAX_TIMEOUT_MS) return
    const timer = setTimeout(() => setOvertime(true), Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [endsAt, overtime])

  if (!overtime) return null
  return (
    <div
      className="rounded-3xl bg-muted px-4 py-3 text-sm"
      role="status"
      data-testid="overtime-notice"
    >
      <span className="font-medium">{labels.overtimeTitle}</span>
      <span
        className="mt-1 block text-muted-foreground"
        suppressHydrationWarning
      >
        {labels.overtimeBody(formatCloseTime(closesAt))}
      </span>
    </div>
  )
}

function formatCloseTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { timeStyle: "short" })
  } catch {
    return iso
  }
}
