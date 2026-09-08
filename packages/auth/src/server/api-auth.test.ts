import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnauthorizedError } from "../types"

const getSession = vi.fn()
const verifyApiKey = vi.fn()
const verifyBetterAuthJwt = vi.fn()
const dbSelect = vi.fn()

vi.mock("./auth", () => ({
  getAuthApi: () => ({ getSession, verifyApiKey }),
}))

vi.mock("./jwt-verify", () => ({
  verifyBetterAuthJwt: (...args: unknown[]) => verifyBetterAuthJwt(...args),
}))

vi.mock("@eleva/db", () => ({
  db: () => ({ select: dbSelect }),
  auth: {
    member: {
      role: "role",
      userId: "user_id",
      organizationId: "organization_id",
    },
    organization: {
      id: "id",
      type: "type",
      slug: "slug",
    },
  },
}))

import { requireApiAuth } from "./api-auth"

function jwtToken() {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: "k1" })
  ).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ sub: "user-1", orgId: "org-1" })
  ).toString("base64url")
  return `${header}.${payload}.sig`
}

function membershipRow() {
  return {
    role: "owner",
    orgType: "personal",
    orgSlug: "space-user1",
  }
}

function mockMembership() {
  dbSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => [membershipRow()],
        }),
      }),
    }),
  })
}

describe("requireApiAuth", () => {
  beforeEach(() => {
    getSession.mockReset()
    verifyApiKey.mockReset()
    verifyBetterAuthJwt.mockReset()
    dbSelect.mockReset()
    mockMembership()
  })

  it("resolves a session cookie alone", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "org-1" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: { cookie: "better-auth.session_token=abc" },
      })
    )
    expect(identity.authMode).toBe("cookie")
    expect(identity.user.id).toBe("user-1")
    expect(identity.productLabel).toBe("member")
  })

  it("resolves an opaque bearer token alone", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "org-1" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: { authorization: "Bearer opaque-session" },
      })
    )
    expect(identity.authMode).toBe("bearer")
  })

  it("resolves a JWT via JWKS without getSession", async () => {
    verifyBetterAuthJwt.mockResolvedValue({
      sub: "user-1",
      orgId: "org-1",
      email: "a@b.c",
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: { authorization: `Bearer ${jwtToken()}` },
      })
    )
    expect(identity.authMode).toBe("jwt")
    expect(getSession).not.toHaveBeenCalled()
  })

  it("resolves x-api-key alone", async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { userId: "user-1", referenceId: "org-1", name: "ci" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: { "x-api-key": "key_abc" },
      })
    )
    expect(identity.authMode).toBe("api-key")
  })

  it.each([
    [
      "cookie+Bearer",
      {
        cookie: "better-auth.session_token=abc",
        authorization: "Bearer opaque",
      },
    ],
    [
      "cookie+API key",
      {
        cookie: "better-auth.session_token=abc",
        "x-api-key": "key_abc",
      },
    ],
    [
      "Bearer+API key",
      { authorization: "Bearer opaque", "x-api-key": "key_abc" },
    ],
    [
      "all three",
      {
        cookie: "better-auth.session_token=abc",
        authorization: "Bearer opaque",
        "x-api-key": "key_abc",
      },
    ],
  ])("rejects %s with AMBIGUOUS_CREDENTIALS", async (_label, headers) => {
    await expect(
      requireApiAuth(new Request("http://localhost/x", { headers }))
    ).rejects.toMatchObject({
      code: "ambiguous-credentials",
      message: "AMBIGUOUS_CREDENTIALS",
    })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("returns 401-style invalid-token when JWKS verify fails", async () => {
    verifyBetterAuthJwt.mockRejectedValue(new Error("bad sig"))
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          headers: { authorization: `Bearer ${jwtToken()}` },
        })
      )
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it("rejects duplicate session cookies as SESSION_COOKIE_AMBIGUOUS", async () => {
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          headers: {
            cookie:
              "better-auth.session_token=abc; better-auth.session_token=xyz",
          },
        })
      )
    ).rejects.toMatchObject({
      code: "session-cookie-ambiguous",
      message: "SESSION_COOKIE_AMBIGUOUS",
    })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("rejects cross-site cookie POST as CSRF_ORIGIN_MISMATCH", async () => {
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          method: "POST",
          headers: {
            cookie: "better-auth.session_token=abc",
            "sec-fetch-site": "cross-site",
          },
        })
      )
    ).rejects.toMatchObject({
      code: "csrf-origin-mismatch",
      message: "CSRF_ORIGIN_MISMATCH",
    })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("rejects untrusted Origin on cookie POST", async () => {
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          method: "POST",
          headers: {
            cookie: "better-auth.session_token=abc",
            origin: "https://evil.example",
          },
        })
      )
    ).rejects.toMatchObject({
      code: "csrf-origin-mismatch",
    })
  })

  it("allows Bearer POST from a cross-site caller", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "org-1" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        method: "POST",
        headers: {
          authorization: "Bearer opaque-session",
          "sec-fetch-site": "cross-site",
        },
      })
    )
    expect(identity.authMode).toBe("bearer")
  })

  it("allows API-key POST from a cross-site caller", async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { userId: "user-1", referenceId: "org-1", name: "ci" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        method: "POST",
        headers: {
          "x-api-key": "key_abc",
          "sec-fetch-site": "cross-site",
        },
      })
    )
    expect(identity.authMode).toBe("api-key")
  })

  it("allows same-site cookie POST from a trusted origin", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "org-1" },
    })
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=abc",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-site",
        },
      })
    )
    expect(identity.authMode).toBe("cookie")
  })
})
