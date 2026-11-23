import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  authWait,
  authWaitWords,
  RATE_LIMITED_CODE,
  SECOND_STEP_LOCK_SECONDS,
  waitForPeople,
} from "./rate-limited"

describe("authWait", () => {
  it("is nothing for an answer that does not mean wait", () => {
    expect(authWait(null)).toBeNull()
    expect(authWait(undefined)).toBeNull()
    expect(
      authWait({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })
    ).toBeNull()
    // A code alone is not the limiter's refusal.
    expect(
      authWait({ status: 400, code: RATE_LIMITED_CODE, retryAfter: 60 })
    ).toBeNull()
  })

  it("reads the limiter's seconds", () => {
    expect(
      authWait({ status: 429, code: RATE_LIMITED_CODE, retryAfter: 60 })
    ).toEqual({ seconds: 60 })
    expect(authWait({ status: 429, retryAfter: "10" })).toEqual({ seconds: 10 })
    // Never told too short.
    expect(authWait({ status: 429, retryAfter: 0.2 })).toEqual({ seconds: 1 })
  })

  it("knows how long the second step locks", () => {
    expect(
      authWait({ status: 429, code: "ACCOUNT_TEMPORARILY_LOCKED" })
    ).toEqual({ seconds: SECOND_STEP_LOCK_SECONDS })
    expect(SECOND_STEP_LOCK_SECONDS).toBe(900)
  })

  it.each([undefined, null, "", "soon", Number.NaN, 0, -5, 86_400, {}])(
    "says wait, without a time, for %j",
    (retryAfter) => {
      expect(authWait({ status: 429, retryAfter })).toEqual({ seconds: null })
    }
  )
})

describe("waitForPeople", () => {
  it("says seconds under a minute", () => {
    expect(waitForPeople(1)).toEqual({ unit: "seconds", count: 1 })
    expect(waitForPeople(10)).toEqual({ unit: "seconds", count: 10 })
    expect(waitForPeople(59)).toEqual({ unit: "seconds", count: 59 })
  })

  it("says whole minutes from one minute on, rounded up", () => {
    // "1 minute", not "60 seconds".
    expect(waitForPeople(60)).toEqual({ unit: "minutes", count: 1 })
    expect(waitForPeople(61)).toEqual({ unit: "minutes", count: 2 })
    expect(waitForPeople(300)).toEqual({ unit: "minutes", count: 5 })
    expect(waitForPeople(900)).toEqual({ unit: "minutes", count: 15 })
  })
})

describe("authWaitWords", () => {
  /** Each message as its key and what it was given. */
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key

  it("says nothing for an answer that does not mean wait", () => {
    expect(authWaitWords({ status: 401 }, t)).toBeNull()
    expect(authWaitWords(null, t, "signIn")).toBeNull()
  })

  it("says the seconds, or the minutes, the answer gave", () => {
    expect(authWaitWords({ status: 429, retryAfter: 60 }, t)).toBe(
      'waitMinutes:{"count":1}'
    )
    expect(authWaitWords({ status: 429, retryAfter: 10 }, t)).toBe(
      'waitSeconds:{"count":10}'
    )
    expect(
      authWaitWords({ status: 429, code: "ACCOUNT_TEMPORARILY_LOCKED" }, t)
    ).toBe('waitMinutes:{"count":15}')
  })

  it("never shows a hole where the time should be", () => {
    expect(authWaitWords({ status: 429 }, t)).toBe("waitAFewMinutes")
    expect(authWaitWords({ status: 429, retryAfter: "soon" }, t)).toBe(
      "waitAFewMinutes"
    )
  })

  it("adds, on the sign-in screen, that another way in still works", () => {
    expect(authWaitWords({ status: 429, retryAfter: 60 }, t, "signIn")).toBe(
      'waitMinutes:{"count":1} waitOtherWays'
    )
    expect(authWaitWords({ status: 429 }, t, "signIn")).toBe(
      "waitAFewMinutes waitOtherWays"
    )
  })
})

describe("the words, in three languages", () => {
  const messages = (locale: string) =>
    (
      JSON.parse(
        readFileSync(
          join(
            import.meta.dirname,
            "../../../apps/account/messages",
            `${locale}.json`
          ),
          "utf8"
        )
      ) as { auth: Record<string, string> }
    ).auth

  it.each(["en", "pt", "es"])(
    "%s has each sentence, with its number",
    (locale) => {
      const auth = messages(locale)
      for (const key of ["waitSeconds", "waitMinutes"]) {
        // One and many are both worded: "1 second", "30 seconds".
        expect(auth[key], key).toMatch(
          /\{count, plural, one \{# \S+\} other \{# \S+\}\}/
        )
      }
      expect(auth.waitAFewMinutes).toBeTruthy()
      expect(auth.waitOtherWays).toBeTruthy()
      // The old sentence promised "a minute" whatever the wait was.
      expect(auth.tooManyAttempts).toBeUndefined()
      // Plain words: no status code, no jargon, nothing about an account
      // being found or not.
      const said = [
        auth.waitSeconds,
        auth.waitMinutes,
        auth.waitAFewMinutes,
        auth.waitOtherWays,
      ].join(" ")
      expect(said).not.toMatch(/429|rate.?limit|request|pedido|solicitud/i)
      expect(said).not.toMatch(/your account|a sua conta|tu cuenta/i)
    }
  )

  it("no language is another's sentence", () => {
    const [en, pt, es] = ["en", "pt", "es"].map(messages)
    for (const key of [
      "waitSeconds",
      "waitMinutes",
      "waitAFewMinutes",
      "waitOtherWays",
    ]) {
      expect(new Set([en![key], pt![key], es![key]]).size, key).toBe(3)
    }
  })
})
