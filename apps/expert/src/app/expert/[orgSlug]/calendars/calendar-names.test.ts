import { describe, expect, it } from "vitest"
import { calendarDisplayName, importedCalendarHost } from "./calendar-names"

const labels = {
  main: "Main calendar",
  imported: (host: string) => `${host} · imported calendar`,
  importedUnknown: "Imported calendar",
}

describe("calendar names", () => {
  it("calls the main calendar 'Main calendar', not the account email", () => {
    expect(
      calendarDisplayName({ name: "pat@gmail.com", primary: true }, labels)
    ).toBe("Main calendar")
    expect(
      calendarDisplayName({ name: "Calendar", primary: true }, labels)
    ).toBe("Main calendar")
  })

  it("keeps other calendar names as they are", () => {
    expect(
      calendarDisplayName({ name: "Osteopatia", primary: false }, labels)
    ).toBe("Osteopatia")
  })

  it("shows only the host of a subscribed feed, never its private token", () => {
    const name =
      "https://www.airbnb.pt/calendar/ical/27579666.ics?s=a9107e66a3d6bf4948119eacf40f9bef"
    const shown = calendarDisplayName({ name, primary: false }, labels)
    expect(shown).toBe("airbnb.pt · imported calendar")
    expect(shown).not.toContain("a9107e66")
  })

  it("hides a feed URL it cannot read", () => {
    const shown = calendarDisplayName(
      { name: "https://[bad host/ical.ics?s=secret-token-123", primary: false },
      labels
    )
    expect(shown).toBe("Imported calendar")
  })

  it("reads webcal feeds too", () => {
    expect(
      importedCalendarHost("webcal://p01-calendars.icloud.com/x.ics")
    ).toBe("p01-calendars.icloud.com")
  })

  it("does not treat ordinary names as feeds", () => {
    expect(importedCalendarHost("Family")).toBeNull()
    expect(importedCalendarHost("http://")).toBeNull()
  })
})
