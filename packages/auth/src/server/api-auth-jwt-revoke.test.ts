import { exportJWK, generateKeyPair, SignJWT } from "jose"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { UnauthorizedError } from "../types"

/**
 * Contract: a Better Auth JWT is a stateless 15-minute token. Revoking the
 * session that minted it does not invalidate it before `exp`; membership is
 * re-read on every request, and privileged mutations refuse JWTs.
 */

const ISSUER = "https://api.eleva.test"

const { getSession, dbSelect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  dbSelect: vi.fn(),
}))

vi.mock("./auth", () => ({
  getAuthApi: () => ({ getSession, verifyApiKey: vi.fn() }),
}))

vi.mock("../provision-personal-space", () => ({
  findDefaultOrganizationId: vi.fn(async () => null),
}))

vi.mock("@eleva/db", () => ({
  db: () => ({ select: dbSelect }),
  auth: {
    member: {
      role: "role",
      userId: "user_id",
      organizationId: "organization_id",
    },
    organization: { id: "id", type: "type", slug: "slug" },
  },
}))

import { requireApiAuth, requireRevocableApiAuth } from "./api-auth"

let privateKey: CryptoKey
const previousIssuer = process.env.BETTER_AUTH_URL

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = ISSUER
  const pair = await generateKeyPair("EdDSA", { crv: "Ed25519" })
  privateKey = pair.privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "EdDSA" }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== `${ISSUER}/jwks`) {
        return new Response("not found", { status: 404 })
      }
      return Response.json({ keys: [jwk] })
    })
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
  process.env.BETTER_AUTH_URL = previousIssuer
})

function mockMembership(rows: unknown[]) {
  dbSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => ({ limit: async () => rows }),
      }),
    }),
  })
}

async function mintJwt(expiresAt: string | number = "15m") {
  return new SignJWT({ orgId: "org-1" })
    .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setSubject("user-1")
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey)
}

function bearer(token: string) {
  return new Request(`${ISSUER}/me`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err
  )
  expect(error).toBeInstanceOf(UnauthorizedError)
  return error as UnauthorizedError
}

describe("JWT after session revoke", () => {
  beforeEach(() => {
    getSession.mockReset()
    // The minting session is revoked: session lookups find nothing.
    getSession.mockResolvedValue(null)
    mockMembership([
      { role: "owner", orgType: "expert", orgSlug: "ana", orgId: "org-1" },
    ])
  })

  it("stays valid for reads until exp without a session lookup", async () => {
    const identity = await requireApiAuth(bearer(await mintJwt()))
    expect(identity).toMatchObject({ authMode: "jwt", orgId: "org-1" })
    expect(getSession).not.toHaveBeenCalled()
  })

  it("is refused for privileged mutations", async () => {
    const error = await rejection(
      requireRevocableApiAuth(bearer(await mintJwt()))
    )
    expect(error.code).toBe("jwt-not-revocable")
  })

  it("is refused once the member leaves the organization", async () => {
    mockMembership([])
    const error = await rejection(requireApiAuth(bearer(await mintJwt())))
    expect(error.code).toBe("not-a-member")
  })

  it("is refused after exp", async () => {
    const expired = await mintJwt(Math.floor(Date.now() / 1000) - 60)
    const error = await rejection(requireApiAuth(bearer(expired)))
    expect(error.code).toBe("invalid-token")
  })
})
