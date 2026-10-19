import type { ReactNode } from "react"
import { cn } from "@eleva/ui/lib/utils"
import type { BookingStatusKey } from "@/lib/booking-status"

function statusTone(status: BookingStatusKey | null): string {
  switch (status) {
    case "confirmed":
    case "rescheduled":
    case "completed":
      return "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
    case "awaiting_confirmation":
    case "pending_payment":
      return "bg-coral-50 text-coral-800 dark:bg-coral-950 dark:text-coral-200"
    case "cancelled":
    case "no_show":
    case null:
      return "bg-muted text-muted-foreground"
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
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusTone(status)
      )}
    >
      {children}
    </span>
  )
}

export function bookingDateParts(
  startsAt: string,
  endsAt: string,
  locale: string,
  timeZone: string
) {
  const start = new Date(startsAt)
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone, ...options })
  return {
    month: format({ month: "short" }).format(start).replace(".", ""),
    day: format({ day: "numeric" }).format(start),
    weekday: format({ weekday: "short" }).format(start).replace(".", ""),
    longDate: format({ weekday: "long", day: "numeric", month: "long" }).format(
      start
    ),
    time: format({ timeStyle: "short" }).format(start),
    timeRange: format({ timeStyle: "short" }).formatRange(
      start,
      new Date(endsAt)
    ),
  }
}

export function DateTile({
  month,
  day,
  weekday,
  large,
}: {
  month: string
  day: string
  weekday: string
  large?: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-2xl bg-sand-100 text-center text-foreground dark:bg-muted",
        large ? "size-24" : "size-16"
      )}
    >
      <span className="eyebrow text-primary">{month}</span>
      <span
        className={cn(
          "font-display leading-none font-normal tabular-nums",
          large ? "text-4xl" : "text-2xl"
        )}
      >
        {day}
      </span>
      <span className="text-xs text-muted-foreground first-letter:uppercase">
        {weekday}
      </span>
    </div>
  )
}
