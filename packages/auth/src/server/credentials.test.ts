import { afterEach, describe, expect, it, vi } from "vitest"
import {
  compactJwsKid,
  expiredSessionCookies,
  hasDuplicateSessionCookie,
  isCompactJws,
  isJwtBearer,
  listCredentialSources,
} from "./credentials"

function request(headers: Record<string, string>) {
  return new Request("http://localhost/test", { headers })
}

describe("listCredentialSources", () => {
  it("detects the session cookie", () => {
    expect(
      listCredentialSources(
        request({ cookie: "better-auth.session_token=abc" })
      )
    ).toEqual(["cookie"])
  })

  it("detects Authorization Bearer", () => {
    expect(
      listCredentialSources(request({ authorization: "Bearer tok_abc" }))
    ).toEqual(["authorization"])
  })

  it("detects x-api-key", () => {
    expect(listCredentialSources(request({ "x-api-key": "key_abc" }))).toEqual([
      "api-key",
    ])
  })

  it("lists every present source without picking a winner", () => {
    expect(
      listCredentialSources(
        request({
          cookie: "better-auth.session_token=abc",
          authorization: "Bearer tok_abc",
          "x-api-key": "key_abc",
        })
      )
    ).toEqual(["cookie", "authorization", "api-key"])
  })
})

describe("JWT discriminator", () => {
  it("accepts compact JWS with kid", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "EdDSA", kid: "k1" })
    ).toString("base64url")
    const payload = Buffer.from(JSON.stringify({ sub: "u1" })).toString(
      "base64url"
    )
    const token = `${header}.${payload}.sig`
    expect(isCompactJws(token)).toBe(true)
    expect(compactJwsKid(token)).toBe("k1")
    expect(isJwtBearer(token)).toBe(true)
  })

  it("treats opaque bearer tokens as non-JWT", () => {
    expect(isJwtBearer("session-token-plain")).toBe(false)
    expect(isCompactJws("a.b")).toBe(false)
  })
})

describe("session cookie tossing", () => {
  it("detects two values for the same session cookie name", () => {
    expect(
      hasDuplicateSessionCookie(
        "better-auth.session_token=abc; better-auth.session_token=xyz"
      )
    ).toBe(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("emits host-only cookies outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    const cookies = expiredSessionCookies()
    expect(cookies.every((value) => value.includes("Max-Age=0"))).toBe(true)
    expect(cookies.every((value) => !value.includes("Domain="))).toBe(true)
  })

  it("emits Max-Age=0 cookies for domain and host in production", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const cookies = expiredSessionCookies()
    expect(cookies.every((value) => value.includes("Max-Age=0"))).toBe(true)
    expect(cookies.some((value) => value.includes("Domain="))).toBe(true)
    expect(cookies.some((value) => !value.includes("Domain="))).toBe(true)
  })
})
