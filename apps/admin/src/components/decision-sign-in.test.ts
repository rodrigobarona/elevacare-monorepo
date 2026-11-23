import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import en from "../../messages/en.json"
import es from "../../messages/es.json"
import pt from "../../messages/pt.json"

// The browser's auth client is not needed to draw the notices.
vi.mock("@eleva/auth/client", () => ({
  authClient: { signOut: vi.fn() },
  readBrowserSession: vi.fn(async () => null),
}))

import {
  DecisionSignInBanner,
  DecisionSignInRefusal,
  DecisionSignInScope,
  type DecisionSignIn,
} from "./decision-sign-in"

const HOURS = STAFF_DECISION_SIGN_IN_MAX_AGE_MS / (60 * 60 * 1000)
const MESSAGES = { en, pt, es } as const

function signIn(msLeft: number | null): DecisionSignIn {
  return {
    msLeft,
    startedAt: msLeft === null ? null : "2026-11-23T08:00:00.000Z",
    hours: HOURS,
    reviewer: { id: "staff-1", email: "ana@eleva.care", orgId: "staff-org" },
    loginUrl: "https://eleva.care/login",
    draftKey: "eleva.decision-draft:clinic:1",
    subject: "clinic",
  }
}

// As the server counted it: an hour past the limit, or eleven hours to go.
const LONG_AGO = -60 * 60 * 1000
const FAR_AHEAD = 11 * 60 * 60 * 1000

function draw(
  locale: keyof typeof MESSAGES,
  msLeft: number | null,
  child: ReactNode
): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: MESSAGES[locale],
      timeZone: "UTC",
      children: createElement(DecisionSignInScope, {
        signIn: signIn(msLeft),
        children: child,
      }),
    })
  )
}

describe("the banner on a review", () => {
  it("is there when the sign-in is already too old, before anything is written", () => {
    const html = draw("en", LONG_AGO, createElement(DecisionSignInBanner))
    expect(html).toContain("Sign in again before you decide")
    // The rule's own number, and the reason in plain words.
    expect(html).toContain(`You signed in more than ${HOURS} hours ago.`)
    expect(html).toContain(
      "so a console left open longer than that can&#x27;t be used to decide in your name"
    )
    expect(html).toContain(
      "What you tick and write here stays in this tab while you sign in."
    )
    // One button, by its name.
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toMatch(/data-testid="sign-in-again"[^>]*>Sign in again</)
  })

  it("is ordinary content when the page opens with it, not an interruption", () => {
    const html = draw("en", LONG_AGO, createElement(DecisionSignInBanner))
    expect(html).toMatch(/data-testid="decision-sign-in-banner"/)
    expect(html).toMatch(/role="note"/)
    // Nothing in it is a live region, and no politeness is set on a note.
    expect(html).not.toMatch(/role="alert"|aria-live/)
    // The region that says it when it appears later is there, and empty.
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
    // Calm, not the red style of a refusal.
    expect(html).not.toMatch(/text-destructive/)
  })

  it("is absent on a recent sign-in, and when the page cannot tell", () => {
    const quiet = /^<p role="status"[^>]*><\/p>$/
    expect(draw("en", FAR_AHEAD, createElement(DecisionSignInBanner))).toMatch(
      quiet
    )
    // Unknown is not "old": the API still decides when a button is pressed.
    expect(draw("en", null, createElement(DecisionSignInBanner))).toMatch(quiet)
  })

  it("says the same in Portuguese and Spanish", () => {
    expect(draw("pt", LONG_AGO, createElement(DecisionSignInBanner))).toContain(
      `Iniciou sessão há mais de ${HOURS} horas. Uma decisão precisa de um início de sessão das últimas ${HOURS} horas`
    )
    expect(draw("es", LONG_AGO, createElement(DecisionSignInBanner))).toContain(
      `Iniciaste sesión hace más de ${HOURS} horas. Una decisión necesita un inicio de sesión de las últimas ${HOURS} horas`
    )
  })
})

describe("the answer to a decision pressed on an old sign-in", () => {
  it("says first that the decision was not saved, and is said at once", () => {
    const html = draw("en", LONG_AGO, createElement(DecisionSignInRefusal))
    // The words are the alert, once, with no politeness beside the role;
    // the button is outside it, so its label changing is not read as one.
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).not.toMatch(/aria-live/)
    expect(html).toMatch(
      /role="alert"[^>]*>(?:(?!<button)[\s\S])*That decision wasn/
    )
    // Its first words stand out as the title: not grey help text.
    expect(html).toMatch(/data-slot="alert-title"[^>]*>That decision wasn/)
    expect(html).not.toMatch(/role="alert"[^>]*>(?:(?!<\/div>)[\s\S])*<button/)
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
    expect(text.trim().startsWith("That decision wasn&#x27;t saved.")).toBe(
      true
    )
    expect(html).toContain("What you entered is still here.")
    expect(html).toMatch(/data-testid="sign-in-again"[^>]*>Sign in again</)
    expect(html).not.toMatch(/text-destructive/)
  })
})

describe("the words", () => {
  const flat = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Object.values(value as Record<string, unknown>).flatMap(flat)

  it.each(["en", "pt", "es"] as const)(
    "%s: no jargon, and the old message is gone",
    (locale) => {
      const messages = MESSAGES[locale]
      const words = flat(messages.signInAgain).join(" ")
      expect(words).not.toMatch(
        /step-up|re-?authenticat|token|session expired|reautentic/i
      )
      // The sentence that told reviewers their reason would be lost.
      expect(JSON.stringify(messages)).not.toMatch(
        /will not keep it|não a guarda\b.*esta página|step-up/
      )
      expect(messages.clinics.detail.errors).not.toHaveProperty("step-up")
      expect(messages.partners.detail.errors).not.toHaveProperty("step-up")
    }
  )

  it("never write the number of hours by hand", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      expect(flat(MESSAGES[locale].signInAgain).join(" ")).not.toMatch(/\d/)
    }
  })
})
