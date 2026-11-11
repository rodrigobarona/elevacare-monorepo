import { describe, expect, it } from "vitest"
import { URGENT_HELP_NUMBERS } from "@eleva/config/urgent-help"
import {
  renderBookingCancelled,
  renderBookingConfirmed,
  renderBookingReminder,
  renderBookingRescheduled,
} from "./render"
import type { EmailLocale } from "./i18n"

const LOCALES: EmailLocale[] = ["en", "pt", "es"]

const base = {
  memberName: "Maria Silva",
  eventTypeName: "First visit",
  formattedDate: "Monday 16 November 2026, 10:00",
  sessionMode: "online",
}

function hasLink(html: string, line: keyof typeof URGENT_HELP_NUMBERS) {
  const { display, href } = URGENT_HELP_NUMBERS[line]
  return new RegExp(`<a[^>]*href="${href}"[^>]*>${display}</a>`).test(html)
}

describe("urgent help in member emails (PRIV2-03)", () => {
  it.each(LOCALES)("confirmation in %s links 112", async (locale) => {
    const html = await renderBookingConfirmed({ ...base, locale })
    expect(hasLink(html, "emergency")).toBe(true)
    // No unreplaced `{line}` placeholder reaches a member.
    expect(html).not.toMatch(/\{(emergency|sns24|prevention1411|linea024)\}/)
  })

  it("confirmation names the national lines of its language", async () => {
    const pt = await renderBookingConfirmed({ ...base, locale: "pt" })
    expect(hasLink(pt, "sns24")).toBe(true)
    expect(hasLink(pt, "prevention1411")).toBe(true)
    const es = await renderBookingConfirmed({ ...base, locale: "es" })
    expect(hasLink(es, "linea024")).toBe(true)
    expect(hasLink(es, "sns24")).toBe(false)
  })

  it("leaves the note out of the expert's copy", async () => {
    const html = await renderBookingConfirmed({
      ...base,
      locale: "pt",
      audience: "expert",
    })
    expect(html).not.toContain('href="tel:')
  })

  it("reminders carry 112 only", async () => {
    const html = await renderBookingReminder({
      ...base,
      window: "24h",
      locale: "pt",
      urgentHelp: "emergency",
    })
    expect(hasLink(html, "emergency")).toBe(true)
    expect(hasLink(html, "prevention1411")).toBe(false)
  })

  it("a cancelled session still tells the member where to turn", async () => {
    const html = await renderBookingCancelled({
      ...base,
      locale: "es",
      urgentHelp: "full",
    })
    expect(hasLink(html, "emergency")).toBe(true)
    expect(hasLink(html, "linea024")).toBe(true)
  })

  it("reminder, reschedule and cancellation omit it unless asked", async () => {
    const htmls = await Promise.all([
      renderBookingReminder({ ...base, window: "1h" }),
      renderBookingRescheduled({
        ...base,
        previousDate: base.formattedDate,
        newDate: "Wednesday 18 November 2026, 14:00",
      }),
      renderBookingCancelled(base),
    ])
    for (const html of htmls) expect(html).not.toContain('href="tel:')
  })
})
