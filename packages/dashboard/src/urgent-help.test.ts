import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import { locales } from "@eleva/config/i18n-locales"
import { URGENT_HELP_NUMBERS } from "@eleva/config/urgent-help"
import { getDashboardMessages } from "./messages"
import { UrgentHelp } from "./urgent-help"

async function render(locale: (typeof locales)[number], variant?: "compact") {
  const messages = await getDashboardMessages(locale)
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: { urgentHelp: messages.urgentHelp },
      children: createElement(UrgentHelp, { variant }),
    })
  )
}

function hasLink(html: string, line: keyof typeof URGENT_HELP_NUMBERS) {
  const { display, href } = URGENT_HELP_NUMBERS[line]
  return new RegExp(`<a href="${href}"[^>]*>${display}</a>`).test(html)
}

describe("UrgentHelp", () => {
  it.each(locales)("links 112 in %s, in both forms", async (locale) => {
    for (const variant of [undefined, "compact"] as const) {
      const html = await render(locale, variant)
      expect(hasLink(html, "emergency")).toBe(true)
      // Every message resolved: no raw key or unrendered tag reaches a member.
      expect(html).not.toContain("urgentHelp.")
      expect(html).not.toMatch(/[{}]|&lt;/)
    }
  })

  it("names SNS 24 and 1411 in Portuguese", async () => {
    const html = await render("pt")
    expect(hasLink(html, "sns24")).toBe(true)
    expect(hasLink(html, "prevention1411")).toBe(true)
    expect(hasLink(html, "linea024")).toBe(false)
  })

  it("names 024 in Spanish", async () => {
    const html = await render("es")
    expect(hasLink(html, "linea024")).toBe(true)
    expect(hasLink(html, "sns24")).toBe(false)
  })

  it("names the lines of both countries in English", async () => {
    const html = await render("en")
    expect(hasLink(html, "sns24")).toBe(true)
    expect(hasLink(html, "prevention1411")).toBe(true)
    expect(hasLink(html, "linea024")).toBe(true)
  })

  it("keeps the form version to 112", async () => {
    const html = await render("pt", "compact")
    expect(hasLink(html, "sns24")).toBe(false)
    expect(html).toContain("<p id=")
    expect(html).not.toContain("<h2")
  })

  it("is a labelled note with a heading on pages", async () => {
    const html = await render("en")
    expect(html).toMatch(/role="note" aria-labelledby="[^"]+"/)
    expect(html).toContain("<h2")
  })
})
