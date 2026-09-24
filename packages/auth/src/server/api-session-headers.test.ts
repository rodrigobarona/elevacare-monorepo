import { describe, expect, it } from "vitest"
import { buildApiSessionHeaders } from "./api-session-headers"

describe("buildApiSessionHeaders", () => {
  it("forwards cookie + Origin when present", () => {
    expect(
      buildApiSessionHeaders(
        new Headers({
          cookie: "better-auth.session_token=abc",
          origin: "http://localhost:3000",
        })
      )
    ).toEqual({
      cookie: "better-auth.session_token=abc",
      origin: "http://localhost:3000",
    })
  })

  it("synthesizes Origin from host when Origin is missing", () => {
    expect(
      buildApiSessionHeaders(
        new Headers({
          cookie: "better-auth.session_token=abc",
          host: "localhost:3001",
        })
      )
    ).toEqual({
      cookie: "better-auth.session_token=abc",
      origin: "http://localhost:3001",
    })
  })

  it("prefers x-forwarded-host for gateway rewrites", () => {
    expect(
      buildApiSessionHeaders(
        new Headers({
          cookie: "s=1",
          host: "localhost:3001",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        })
      )
    ).toEqual({
      cookie: "s=1",
      origin: "http://localhost:3000",
    })
  })

  it("returns undefined when there is nothing to forward", () => {
    expect(buildApiSessionHeaders(new Headers())).toBeUndefined()
  })
})
