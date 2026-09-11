export const MEMBER_CANCEL_POLICY_HOURS = 24

const MUTABLE_STATUSES = new Set(["confirmed", "rescheduled"])

export function eventTitle(
  title: { en: string; pt?: string; es?: string },
  locale: string
): string {
  if (locale === "pt" && title.pt) return title.pt
  if (locale === "es" && title.es) return title.es
  return title.en
}

export function formatMoney(
  amountCents: number,
  locale: string,
  currency = "EUR"
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amountCents / 100
  )
}

export function formatDateTime(
  iso: string,
  locale: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso))
}

export function canChangeBooking(
  startsAt: string,
  status: string,
  now = new Date()
): boolean {
  if (!MUTABLE_STATUSES.has(status)) return false
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return false
  return (
    start.getTime() - now.getTime() >=
    MEMBER_CANCEL_POLICY_HOURS * 60 * 60 * 1000
  )
}

export function toDatetimeLocalValue(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

export function fromDatetimeLocalValue(
  localValue: string,
  timeZone: string
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) {
    throw new Error("invalid datetime")
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  const utcDate = new Date(asUtc)
  const inZone = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }))
  const zoned = new Date(utcDate.toLocaleString("en-US", { timeZone }))
  const offset = inZone.getTime() - zoned.getTime()
  return new Date(asUtc + offset).toISOString()
}
