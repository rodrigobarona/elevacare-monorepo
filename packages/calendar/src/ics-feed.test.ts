import { describe, expect, it } from "vitest"
import { generateIcsFeed, hashCalendarFeedToken, icsFeedEtag } from "./ics-feed"

describe("hashCalendarFeedToken", () => {
  it("returns a 64-char hex digest distinct from the raw token", () => {
    const hash = hashCalendarFeedToken("secret-token")
    expect(hash).toHaveLength(64)
    expect(hash).not.toBe("secret-token")
    expect(hash).toBe(hashCalendarFeedToken("secret-token"))
  })
})

describe("generateIcsFeed", () => {
  const stamp = new Date("2026-09-24T12:00:00.000Z")

  it("emits a PUBLISH calendar with stable booking UIDs", () => {
    const ics = generateIcsFeed({
      calendarName: "Eleva — Ana",
      stamp,
      events: [
        {
          uid: "11111111-1111-4111-8111-111111111111",
          summary: "First visit — Ana",
          description: "Mode: in person\nLocation: Lisboa clinic",
          location: "Lisboa clinic, Lisboa, PT",
          startTime: new Date("2026-10-01T09:00:00.000Z"),
          endTime: new Date("2026-10-01T10:00:00.000Z"),
        },
      ],
    })

    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("METHOD:PUBLISH")
    expect(ics).toContain("X-WR-CALNAME:Eleva — Ana")
    expect(ics).toContain("UID:11111111-1111-4111-8111-111111111111@eleva.care")
    expect(ics).toContain("SUMMARY:First visit — Ana")
    expect(ics).toContain("LOCATION:Lisboa clinic\\, Lisboa\\, PT")
    expect(ics).toContain(
      "DESCRIPTION:Mode: in person\\nLocation: Lisboa clinic"
    )
    expect(ics).toContain("DTSTART:20261001T090000Z")
    expect(ics).toContain("DTEND:20261001T100000Z")
    expect(ics).toContain("DTSTAMP:20260924T120000Z")
    expect(ics.endsWith("\r\n")).toBe(true)
  })

  it("supports an empty feed", () => {
    const ics = generateIcsFeed({
      calendarName: "Eleva",
      stamp,
      events: [],
    })
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).not.toContain("BEGIN:VEVENT")
    expect(ics).toContain("END:VCALENDAR")
  })
})

describe("icsFeedEtag", () => {
  it("is stable for the same body", () => {
    const body = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
    expect(icsFeedEtag(body)).toBe(icsFeedEtag(body))
    expect(icsFeedEtag(body)).toMatch(/^"[a-f0-9]{32}"$/)
  })
})
