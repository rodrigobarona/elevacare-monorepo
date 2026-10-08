import { describe, expect, it } from "vitest"
import { generateIcsRequest } from "./ics-generator"

describe("generateIcsRequest", () => {
  it("emits URL and LOCATION for an Eleva join grant, never a Daily token query", () => {
    const joinHref =
      "https://eleva.care/join/11111111-1111-4111-8111-111111111111?g=grant.jwt"
    const ics = generateIcsRequest({
      uid: "11111111-1111-4111-8111-111111111111",
      summary: "Eleva session with Ana",
      startTime: new Date("2026-10-08T10:00:00.000Z"),
      endTime: new Date("2026-10-08T10:50:00.000Z"),
      timezone: "Europe/Lisbon",
      url: joinHref,
      location: joinHref,
      organizer: { name: "Ana", email: "ana@example.test" },
    })
    const unfolded = ics.replace(/\r\n /g, "")
    expect(unfolded).toContain(`URL:${joinHref}`)
    expect(unfolded).toContain(`LOCATION:${joinHref}`)
    expect(ics).not.toContain("t=")
  })

  it("omits URL when the value is not a valid URI", () => {
    const ics = generateIcsRequest({
      uid: "11111111-1111-4111-8111-111111111111",
      summary: "Eleva session with Ana",
      startTime: new Date("2026-10-08T10:00:00.000Z"),
      endTime: new Date("2026-10-08T10:50:00.000Z"),
      timezone: "Europe/Lisbon",
      url: "not a url",
      organizer: { name: "Ana", email: "ana@example.test" },
    })
    expect(ics).not.toContain("URL:")
  })
})
