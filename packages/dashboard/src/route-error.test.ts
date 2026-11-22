import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { locales } from "@eleva/config/i18n-locales"
import { LEGAL_ENTITY } from "@eleva/config/legal-entity"
import { getDashboardMessages } from "./messages"
import { RouteError } from "./route-error"

// The test runs without a DOM: capture what reaches the button, and let a
// transition run its callback at once (the server build of React refuses it).
const button = vi.hoisted(() => ({
  props: [] as ({ onPress?: () => void } & Record<string, unknown>)[],
}))
// `next/font/local` only works under the Next compiler.
vi.mock("@eleva/ui/fonts", () => ({ fontClassName: "fonts" }))
vi.mock("@eleva/ui/components/button", () => ({
  Button: (props: { onPress?: () => void; children?: unknown }) => {
    button.props.push(props)
    return createElement("button", null, props.children as string)
  },
}))
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>()
  return {
    ...react,
    useTransition: () => [false, (run: () => void) => run()] as const,
  }
})

async function render(locale: (typeof locales)[number], error: unknown) {
  const messages = await getDashboardMessages(locale)
  const retry = vi.fn()
  const html = renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Lisbon",
      messages: { routeStates: messages.routeStates },
      children: createElement(RouteError, { error, retry }),
    })
  )
  return { html, retry }
}

const serverError = Object.assign(new Error("boom: secret detail"), {
  digest: "3912845570",
})

describe("RouteError", () => {
  beforeEach(() => {
    button.props.length = 0
    vi.stubGlobal("window", { location: { pathname: "/space/sessions" } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(locales)(
    "asks the server again on Try again, in %s",
    async (locale) => {
      const { retry } = await render(locale, serverError)
      const tryAgain = button.props[0]
      expect(tryAgain?.onPress).toBeTypeOf("function")
      tryAgain!.onPress!()
      expect(retry).toHaveBeenCalledTimes(1)
    }
  )

  it.each(locales)(
    "shows the reference and how to reach us in %s",
    async (locale) => {
      const { html } = await render(locale, serverError)
      expect(html).toContain(">3912845570</code>")
      expect(html).toMatch(
        new RegExp(
          `href="mailto:${LEGAL_ENTITY.supportEmail}\\?subject=[^"]*3912845570"`
        )
      )
      // Every message resolved: no raw key or unrendered tag reaches a member.
      expect(html).not.toContain("routeStates.")
      expect(html).not.toMatch(/[{}]|&lt;/)
      // Never the error's own words.
      expect(html).not.toContain("secret detail")
    }
  )

  it("is a heading announced once, with the buttons outside the alert", async () => {
    const { html } = await render("en", serverError)
    const alert = html.match(/<div role="alert"[^>]*>(.*?)<\/div>/)?.[1] ?? ""
    expect(alert).toContain("<h1")
    expect(alert).not.toContain("<button")
    expect(html).toContain('aria-hidden="true"')
  })

  it("offers a second way out", async () => {
    const { html } = await render("en", serverError)
    expect(html).toMatch(/<a href="[^"]*\/dashboard"[^>]*>Go to dashboard<\/a>/)
  })

  it.each([
    ["a string", "network down"],
    ["null", null],
    ["undefined", undefined],
    ["an error with no digest", new Error("client")],
    ["a digest that is not a reference", { digest: "<img src=x onerror=1>" }],
    ["one of Next's own names", { digest: "DYNAMIC_SERVER_USAGE" }],
  ])(
    "renders with no reference row when %s is thrown",
    async (_name, thrown) => {
      const { html } = await render("en", thrown)
      expect(html).toContain("tell us which page you were on")
      expect(html).not.toContain("<code")
      expect(html).toContain(
        `href="mailto:${LEGAL_ENTITY.supportEmail}?subject=A%20page%20didn%E2%80%99t%20load%20on%20Eleva"`
      )
      // Only "Try again": no button to copy a reference that is not there.
      expect(button.props).toHaveLength(1)
    }
  )

  it.each(locales)(
    "says the same as the full-page fallback in %s",
    async (locale) => {
      const { GLOBAL_ERROR_COPY } =
        await import("@eleva/ui/components/global-error")
      const messages = await getDashboardMessages(locale)
      const page = messages.routeStates as Record<string, string>
      const fallback = GLOBAL_ERROR_COPY[locale]
      const plain = (text?: string) => text?.replace(/<\/?link>/g, "")
      expect({
        offline: page.errorOffline,
        retry: page.retry,
        retrying: page.retrying,
        retryFailed: page.retryFailed,
        support: plain(page.errorSupport),
        supportNoReference: plain(page.errorSupportNoReference),
        emailSubject: page.errorEmailSubject,
        emailSubjectNoReference: page.errorEmailSubjectNoReference,
        reference: page.errorReferenceLabel,
        copyReference: page.copyReference,
        copied: page.copied,
        referenceCopied: page.referenceCopied,
        referenceSelected: page.referenceSelected,
      }).toEqual({
        offline: fallback.offline,
        retry: fallback.retry,
        retrying: fallback.retrying,
        retryFailed: fallback.retryFailed,
        support: fallback.support,
        supportNoReference: fallback.supportNoReference,
        emailSubject: fallback.emailSubject,
        emailSubjectNoReference: fallback.emailSubjectNoReference,
        reference: fallback.reference,
        copyReference: fallback.copyReference,
        copied: fallback.copied,
        referenceCopied: fallback.referenceCopied,
        referenceSelected: fallback.referenceSelected,
      })
    }
  )
})
