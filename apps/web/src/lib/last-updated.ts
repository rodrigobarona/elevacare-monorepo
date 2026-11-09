import type { getFormatter } from "next-intl/server"

type Formatter = Awaited<ReturnType<typeof getFormatter>>

/** "2026-11-07" → "7 November 2026" in the page language (EU date order). */
export function formatLastUpdated(format: Formatter, isoDate: string): string {
  return format.dateTime(new Date(`${isoDate}T00:00:00Z`), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}
