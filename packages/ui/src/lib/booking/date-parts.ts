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
