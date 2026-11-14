/**
 * "Add to calendar" links for web calendars: the member chooses, and the
 * event opens prefilled in her own calendar. Apple Calendar and others use
 * the `.ics` file from `ics-download`.
 */
export type CalendarEvent = {
  title: string
  details?: string
  location?: string
  /** ISO 8601 instants. */
  start: string
  end: string
}

export type CalendarLinks = {
  google: string
  outlook: string
  office365: string
}

/** "2026-12-11T16:00:00.000Z" → "20261211T160000Z". */
function googleStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

function outlookUrl(host: string, event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(event.end).toISOString(),
  })
  if (event.details) params.set("body", event.details)
  if (event.location) params.set("location", event.location)
  return `https://${host}/calendar/0/action/compose?${params}`
}

export function calendarLinks(event: CalendarEvent): CalendarLinks {
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("calendarLinks: invalid start/end timestamp")
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("calendarLinks: end must be after start")
  }
  const google = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${googleStamp(event.start)}/${googleStamp(event.end)}`,
  })
  if (event.details) google.set("details", event.details)
  if (event.location) google.set("location", event.location)
  return {
    google: `https://calendar.google.com/calendar/render?${google}`,
    outlook: outlookUrl("outlook.live.com", event),
    office365: outlookUrl("outlook.office.com", event),
  }
}
