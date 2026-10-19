import type { ReactNode } from "react"
import { StatusPill as UiStatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"
import type { BookingStatusKey } from "@/lib/booking-status"

function statusTone(status: BookingStatusKey | null): StatusTone {
  switch (status) {
    case "confirmed":
    case "rescheduled":
    case "completed":
      return "positive"
    case "awaiting_confirmation":
    case "pending_payment":
      return "attention"
    case "cancelled":
    case "no_show":
    case null:
      return "neutral"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export function StatusPill({
  status,
  children,
}: {
  status: BookingStatusKey | null
  children: ReactNode
}) {
  return <UiStatusPill tone={statusTone(status)}>{children}</UiStatusPill>
}
