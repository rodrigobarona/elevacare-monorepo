import { describe, expect, it } from "vitest"
import { calendarLinks } from "./calendar-links"

const event = {
  title: "First visit · Inês Mota",
  details: "Your join link is in your confirmation email.",
  location: "Video session",
  start: "2026-12-11T16:00:00.000Z",
  end: "2026-12-11T17:00:00.000Z",
}

describe("calendarLinks", () => {
  it("prefills Google Calendar with UTC times", () => {
    const url = new URL(calendarLinks(event).google)
    expect(url.origin).toBe("https://calendar.google.com")
    expect(url.searchParams.get("action")).toBe("TEMPLATE")
    expect(url.searchParams.get("text")).toBe(event.title)
    expect(url.searchParams.get("dates")).toBe(
      "20261211T160000Z/20261211T170000Z"
    )
    expect(url.searchParams.get("location")).toBe("Video session")
  })

  it("prefills Outlook and Microsoft 365", () => {
    const links = calendarLinks(event)
    for (const [href, host] of [
      [links.outlook, "outlook.live.com"],
      [links.office365, "outlook.office.com"],
    ] as const) {
      const url = new URL(href)
      expect(url.host).toBe(host)
      expect(url.searchParams.get("subject")).toBe(event.title)
      expect(url.searchParams.get("startdt")).toBe(event.start)
      expect(url.searchParams.get("enddt")).toBe(event.end)
      expect(url.searchParams.get("body")).toBe(event.details)
    }
  })

  it("leaves out empty details and location", () => {
    const url = new URL(
      calendarLinks({ ...event, details: undefined, location: undefined })
        .google
    )
    expect(url.searchParams.has("details")).toBe(false)
    expect(url.searchParams.has("location")).toBe(false)
  })

  it("rejects an end before the start", () => {
    expect(() =>
      calendarLinks({ ...event, end: "2026-12-11T15:00:00.000Z" })
    ).toThrow(/end must be after start/)
  })
})
