import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnauthorizedError } from "../types"

const {
  getSession,
  verifyApiKey,
  verifyBetterAuthJwt,
  dbSelect,
  findDefaultOrganizationId,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyApiKey: vi.fn(),
  verifyBetterAuthJwt: vi.fn(),
  dbSelect: vi.fn(),
  findDefaultOrganizationId: vi.fn(),
}))

vi.mock("./auth", () => ({
  getAuthApi: () => ({ getSession, verifyApiKey }),
}))

vi.mock("./jwt-verify", () => ({
  verifyBetterAuthJwt: (...args: unknown[]) => verifyBetterAuthJwt(...args),
}))

vi.mock("../provision-personal-space", () => ({
  findDefaultOrganizationId: (...args: unknown[]) =>
    findDefaultOrganizationId(...args),
}))

vi.mock("@eleva/db", () => ({
  db: () => ({ select: dbSelect }),
  auth: {
    user: {
      id: "id",
      email: "email",
      name: "name",
      image: "image",
      emailVerified: "email_verified",
      banned: "banned",
      banExpires: "ban_expires",
    },
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

import { requireApiAuth, requireApiUser } from "./api-auth"

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
    orgId: "org-1",
  }
}

const OWNER_ID = "0b9f6a52-2f0e-4c53-9d0c-6a1a4e8f1c11"

function ownerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OWNER_ID,
    email: "ada@example.test",
    name: "Ada",
    image: null,
    emailVerified: true,
    banned: false,
    banExpires: null,
    ...overrides,
  }
}

/** What the installed key plugin answers for a key that verifies. */
function verifiedKey(overrides: Record<string, unknown> = {}) {
  return {
    valid: true,
    error: null,
    key: {
      id: "key-1",
      configId: "default",
      name: "ci",
      referenceId: OWNER_ID,
      createdAt: new Date("2026-12-01T10:00:00.000Z"),
      enabled: true,
      metadata: null,
      permissions: null,
      ...overrides,
    },
  }
}

/**
 * Membership reads join two tables; the read of a key's owner does not.
 * `owner` is the row that second read finds (none when null).
 */
function mockMembership(owner: Record<string, unknown> | null = ownerRow()) {
  dbSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => [membershipRow()],
        }),
      }),
      where: () => ({
        limit: async () => (owner ? [owner] : []),
      }),
    }),
  })
}

function withKey(headers: Record<string, string> = {}) {
  return new Request("http://localhost/x", {
    headers: { "x-api-key": "key_abc", ...headers },
  })
}

describe("requireApiAuth", () => {
  beforeEach(() => {
    getSession.mockReset()
    verifyApiKey.mockReset()
    verifyBetterAuthJwt.mockReset()
    dbSelect.mockReset()
    findDefaultOrganizationId.mockReset()
    findDefaultOrganizationId.mockResolvedValue(null)
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
    expect(findDefaultOrganizationId).not.toHaveBeenCalled()
  })

  it("falls back to the personal Space when activeOrganizationId is null", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: null },
    })
    findDefaultOrganizationId.mockResolvedValue("org-1")
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: { cookie: "better-auth.session_token=abc" },
      })
    )
    expect(identity.orgId).toBe("org-1")
    expect(identity.productLabel).toBe("member")
    expect(findDefaultOrganizationId).toHaveBeenCalledWith("user-1")
  })

  it("rejects when there is no active org and no membership fallback", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: null },
    })
    findDefaultOrganizationId.mockResolvedValue(null)
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          headers: { cookie: "better-auth.session_token=abc" },
        })
      )
    ).rejects.toMatchObject({
      code: "no-session",
      message: "active organization required",
    })
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

  it("resolves x-api-key alone as the person who owns the key", async () => {
    verifyApiKey.mockResolvedValue(verifiedKey())
    findDefaultOrganizationId.mockResolvedValue("org-1")
    const identity = await requireApiAuth(withKey())
    expect(identity.authMode).toBe("api-key")
    // The owner's own row, not the key's name or an empty address.
    expect(identity.user).toEqual({
      id: OWNER_ID,
      email: "ada@example.test",
      displayName: "Ada",
      avatarUrl: null,
    })
    // A key carries no sign-in moment, so it can pass no recency check.
    expect(identity.authenticatedAt).toBeNull()
    // The key names no workspace: the owner's default one is used, and the
    // owner's id is never taken for an organization.
    expect(findDefaultOrganizationId).toHaveBeenCalledWith(OWNER_ID)
    expect(identity.orgId).toBe("org-1")
  })

  it("acts in the workspace the request names, when the owner belongs to it", async () => {
    verifyApiKey.mockResolvedValue(verifiedKey())
    const identity = await requireApiAuth(
      withKey({ "x-eleva-org": "space-user1" })
    )
    expect(identity.orgSlug).toBe("space-user1")
    expect(findDefaultOrganizationId).not.toHaveBeenCalled()
  })

  it.each([
    [
      "the plugin says it is not valid",
      { valid: false, error: null, key: null },
    ],
    ["the plugin answers nothing", null],
    ["valid, but with no key record", { valid: true, error: null, key: null }],
    [
      "a key of another configuration, whose owner may be an organization",
      verifiedKey({ configId: "organization-keys" }),
    ],
    ["a key with no owner", verifiedKey({ referenceId: null })],
    [
      "a key made while any session could make one",
      verifiedKey({ createdAt: new Date("2026-11-23T23:59:59.000Z") }),
    ],
    ["a key with no readable date", verifiedKey({ createdAt: undefined })],
    [
      "an owner that is not a person's id",
      verifiedKey({ referenceId: "org_staff" }),
    ],
    [
      "an old key that only has the field the plugin dropped",
      verifiedKey({ referenceId: undefined, userId: OWNER_ID }),
    ],
  ])("refuses a key when %s", async (_name, answer) => {
    verifyApiKey.mockResolvedValue(answer)
    await expect(requireApiAuth(withKey())).rejects.toMatchObject({
      code: "invalid-token",
    })
    // Refused before any person or workspace is looked up.
    expect(dbSelect).not.toHaveBeenCalled()
    expect(findDefaultOrganizationId).not.toHaveBeenCalled()
  })

  it.each([
    ["is gone", null],
    ["never verified their address", ownerRow({ emailVerified: false })],
    ["is banned", ownerRow({ banned: true })],
    [
      "is banned until tomorrow",
      ownerRow({ banned: true, banExpires: new Date(Date.now() + 86_400_000) }),
    ],
  ])("refuses a valid key whose owner %s", async (_name, owner) => {
    verifyApiKey.mockResolvedValue(verifiedKey())
    mockMembership(owner)
    await expect(requireApiAuth(withKey())).rejects.toMatchObject({
      code: "invalid-token",
    })
    expect(findDefaultOrganizationId).not.toHaveBeenCalled()
  })

  it("refuses a valid key whose owner belongs to no workspace, as a member problem", async () => {
    verifyApiKey.mockResolvedValue(verifiedKey())
    findDefaultOrganizationId.mockResolvedValue(null)
    // 403, not "no credential": optional sign-in must not treat it as a visitor.
    await expect(requireApiAuth(withKey())).rejects.toMatchObject({
      code: "not-a-member",
    })
  })

  it("accepts a key again once its owner's ban has run out", async () => {
    verifyApiKey.mockResolvedValue(verifiedKey())
    findDefaultOrganizationId.mockResolvedValue("org-1")
    mockMembership(
      ownerRow({ banned: true, banExpires: new Date(Date.now() - 1000) })
    )
    const identity = await requireApiAuth(withKey())
    expect(identity.user.id).toBe(OWNER_ID)
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

  it("rejects cookie POST with no Origin and no Sec-Fetch-Site", async () => {
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          method: "POST",
          headers: { cookie: "better-auth.session_token=abc" },
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
    verifyApiKey.mockResolvedValue(verifiedKey())
    findDefaultOrganizationId.mockResolvedValue("org-1")
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

describe("requireApiUser", () => {
  beforeEach(() => {
    getSession.mockReset()
    verifyApiKey.mockReset()
    dbSelect.mockReset()
    findDefaultOrganizationId.mockReset()
  })

  it("resolves a signed-in person who has no membership yet", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: null },
    })
    const identity = await requireApiUser(
      new Request("http://localhost/x", {
        headers: { cookie: "better-auth.session_token=abc" },
      })
    )
    expect(identity).toEqual({
      user: {
        id: "user-1",
        email: "a@b.c",
        displayName: "Ada",
        avatarUrl: null,
      },
      activeOrgId: null,
      authMode: "cookie",
    })
    expect(dbSelect).not.toHaveBeenCalled()
  })

  it("rejects a JWT bearer", async () => {
    await expect(
      requireApiUser(
        new Request("http://localhost/x", {
          headers: { authorization: `Bearer ${jwtToken()}` },
        })
      )
    ).rejects.toMatchObject({ code: "jwt-not-revocable" })
  })

  it("rejects an API key", async () => {
    await expect(
      requireApiUser(
        new Request("http://localhost/x", {
          headers: { "x-api-key": "key_abc" },
        })
      )
    ).rejects.toMatchObject({ code: "missing-capability" })
    expect(verifyApiKey).not.toHaveBeenCalled()
  })

  it("rejects a cross-site cookie POST", async () => {
    await expect(
      requireApiUser(
        new Request("http://localhost/x", {
          method: "POST",
          headers: {
            cookie: "better-auth.session_token=abc",
            origin: "https://evil.example",
          },
        })
      )
    ).rejects.toBeInstanceOf(UnauthorizedError)
    expect(getSession).not.toHaveBeenCalled()
  })

  it("rejects an expired session", async () => {
    getSession.mockResolvedValue(null)
    await expect(
      requireApiUser(
        new Request("http://localhost/x", {
          headers: { cookie: "better-auth.session_token=abc" },
        })
      )
    ).rejects.toMatchObject({ code: "invalid-token" })
  })
})

describe("requireApiAuth with a named workspace (x-eleva-org)", () => {
  beforeEach(() => {
    getSession.mockReset()
    dbSelect.mockReset()
    findDefaultOrganizationId.mockReset()
  })

  function rows(...results: unknown[][]) {
    for (const result of results) {
      dbSelect.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({ limit: async () => result }),
          }),
        }),
      })
    }
  }

  it("acts for the named workspace instead of the active one", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "space-org" },
    })
    rows(
      [{ orgId: "practice-org" }],
      [
        {
          role: "owner",
          orgType: "expert",
          orgSlug: "ada-practice",
          orgId: "practice-org",
        },
      ]
    )
    const identity = await requireApiAuth(
      new Request("http://localhost/x", {
        headers: {
          cookie: "better-auth.session_token=abc",
          "x-eleva-org": "ada-practice",
        },
      })
    )
    expect(identity.orgId).toBe("practice-org")
    expect(identity.productLabel).toBe("expert")
  })

  it("refuses a named workspace the person does not belong to", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.c", name: "Ada", image: null },
      session: { activeOrganizationId: "space-org" },
    })
    rows([])
    await expect(
      requireApiAuth(
        new Request("http://localhost/x", {
          headers: {
            cookie: "better-auth.session_token=abc",
            "x-eleva-org": "someone-elses-clinic",
          },
        })
      )
    ).rejects.toMatchObject({ code: "not-a-member" })
  })
})
