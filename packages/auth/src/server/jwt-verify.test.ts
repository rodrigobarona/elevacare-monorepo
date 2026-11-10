import { describe, expect, it } from "vitest"
import { jwksUrlFor } from "./jwt-verify"

describe("jwksUrlFor", () => {
  it("keeps the auth base path", () => {
    expect(jwksUrlFor("https://api.eleva.care/auth").toString()).toBe(
      "https://api.eleva.care/auth/jwks"
    )
    expect(jwksUrlFor("https://api.eleva.care/auth/").toString()).toBe(
      "https://api.eleva.care/auth/jwks"
    )
  })

  it("works when auth is served at the root", () => {
    expect(jwksUrlFor("http://localhost:3002").toString()).toBe(
      "http://localhost:3002/jwks"
    )
  })
})
