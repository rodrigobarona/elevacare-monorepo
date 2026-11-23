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
}))

import {
  DecisionSignInBanner,
  DecisionSignInRefusal,
  DecisionSignInScope,
  type DecisionSignIn,
} from "./decision-sign-in"

const HOURS = STAFF_DECISION_SIGN_IN_MAX_AGE_MS / (60 * 60 * 1000)
const MESSAGES = { en, pt, es } as const

function signIn(decideBy: string | null): DecisionSignIn {
  return {
    decideBy,
    hours: HOURS,
    reviewer: { id: "staff-1", email: "ana@eleva.care" },
    loginUrl: "https://eleva.care/login",
    draftKey: "eleva.decision-draft:clinic:1",
    subject: "clinic",
  }
}

const LONG_AGO = "2001-01-01T00:00:00.000Z"
const FAR_AHEAD = "2999-01-01T00:00:00.000Z"

function draw(
  locale: keyof typeof MESSAGES,
  decideBy: string | null,
  child: ReactNode
): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: MESSAGES[locale],
      timeZone: "UTC",
      children: createElement(DecisionSignInScope, {
        signIn: signIn(decideBy),
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
      "so a console left open can&#x27;t be used to decide in your name"
    )
    expect(html).toContain(
      "Your ticks and your reason stay on this page while you sign in."
    )
    // One button, by its name.
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toMatch(/data-testid="sign-in-again"[^>]*>Sign in again</)
  })

  it("is ordinary content when the page opens with it, not an interruption", () => {
    const html = draw("en", LONG_AGO, createElement(DecisionSignInBanner))
    expect(html).toMatch(/role="note"/)
    expect(html).toMatch(/aria-live="off"/)
    // Calm, not the red style of a refusal.
    expect(html).not.toMatch(/text-destructive/)
  })

  it("is absent on a recent sign-in, and when the page cannot tell", () => {
    expect(draw("en", FAR_AHEAD, createElement(DecisionSignInBanner))).toBe("")
    // Unknown is not "old": the API still decides when a button is pressed.
    expect(draw("en", null, createElement(DecisionSignInBanner))).toBe("")
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
    expect(html).toMatch(/role="alert"/)
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
    expect(text.trim().startsWith("That decision wasn&#x27;t saved.")).toBe(
      true
    )
    expect(html).toContain("Your ticks and your reason are kept.")
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
