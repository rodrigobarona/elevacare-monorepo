import { generateIcsRequest } from "@eleva/calendar/ics"

export function downloadBookingIcs(input: {
  uid: string
  summary: string
  description: string
  start: string
  end: string
  timeZone: string
  location?: string
  expertName: string
  memberName: string
  memberEmail: string
}): void {
  const startTime = new Date(input.start)
  const endTime = new Date(input.end)
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new Error("downloadBookingIcs: invalid start/end timestamp")
  }
  if (endTime.getTime() <= startTime.getTime()) {
    throw new Error("downloadBookingIcs: end must be after start")
  }
  const ics = generateIcsRequest({
    uid: input.uid,
    summary: input.summary,
    description: input.description,
    startTime,
    endTime,
    timezone: input.timeZone,
    location: input.location,
    organizer: {
      name: input.expertName,
      email: "bookings@eleva.care",
    },
    attendees: [{ name: input.memberName, email: input.memberEmail }],
  })
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  const stamp = startTime.toISOString().slice(0, 10)
  anchor.download = `eleva-session-${stamp}.ics`
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
