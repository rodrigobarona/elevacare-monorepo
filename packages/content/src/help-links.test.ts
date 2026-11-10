import { describe, expect, it } from "vitest"
import { helpLinkOptions } from "./help-links"

describe("helpLinkOptions", () => {
  const pt = helpLinkOptions("/pt", "https://dev.eleva.care/")
  const en = helpLinkOptions("", "https://dev.eleva.care")
  const resolvePt = pt.resolveHref!
  const resolveEn = en.resolveHref!

  it("keeps the reader's language on help links", () => {
    expect(resolvePt("/experts/getting-started/setup")).toBe(
      "/pt/experts/getting-started/setup"
    )
    expect(resolvePt("/members")).toBe("/pt/members")
    expect(resolvePt("/clinics#start")).toBe("/pt/clinics#start")
    expect(resolveEn("/members/booking")).toBe("/members/booking")
  })

  it("leaves links that already carry a language alone", () => {
    expect(resolvePt("/es/experts/sessions/bookings")).toBe(
      "/es/experts/sessions/bookings"
    )
  })

  it("does not touch paths that only start like a portal", () => {
    expect(resolvePt("/expertsx")).toBe("/expertsx")
  })

  it("sends eleva.care links to this deployment's site", () => {
    expect(resolvePt("https://eleva.care/pt/legal/privacy")).toBe(
      "https://dev.eleva.care/pt/legal/privacy"
    )
    expect(resolveEn("https://www.eleva.care")).toBe("https://dev.eleva.care")
    expect(resolveEn("https://eleva.care.evil.example/x")).toBe(
      "https://eleva.care.evil.example/x"
    )
    expect(en.siteOrigin).toBe("https://dev.eleva.care")
  })

  it("leaves other links alone", () => {
    expect(resolveEn("mailto:support@eleva.care")).toBe(
      "mailto:support@eleva.care"
    )
    expect(resolveEn("https://stripe.com/docs")).toBe("https://stripe.com/docs")
  })
})
