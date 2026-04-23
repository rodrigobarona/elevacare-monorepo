import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { VaultRef } from "./vault"

describe("encryptOAuthToken / decryptOAuthToken", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("serialises refresh token + expiresAt as ISO string into vault", async () => {
    const createObject = vi.fn().mockResolvedValue({ id: "obj_xyz" })
    vi.doMock("./client.js", () => ({
      workos: () => ({
        vault: { createObject, readObject: vi.fn(), deleteObject: vi.fn() },
      }),
      vaultNamespace: () => "eleva-v3-main",
    }))
    const { encryptOAuthToken } = await import("./tokens.js")
    const ref = await encryptOAuthToken({
      provider: "google-calendar",
      userId: "user_1",
      orgId: "org_1",
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    })
    expect(ref).toBe("vault:eleva-v3-main:obj_xyz")
    expect(createObject).toHaveBeenCalledOnce()
    const [arg] = createObject.mock.calls[0] as [
      { name: string; value: string; context: unknown },
    ]
    expect(arg.name).toBe("oauth/google-calendar/user_1")
    const parsed = JSON.parse(arg.value)
    expect(parsed).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: "2026-01-01T00:00:00.000Z",
    })
    expect(arg.context).toMatchObject({
      provider: "google-calendar",
      userId: "user_1",
      orgId: "org_1",
    })
  })

  it("round-trip through decryptOAuthToken returns Date", async () => {
    const storedValue = JSON.stringify({
      accessToken: "at",
      refreshToken: null,
      expiresAt: "2026-01-01T00:00:00.000Z",
    })
    vi.doMock("./client.js", () => ({
      workos: () => ({
        vault: {
          readObject: vi
            .fn()
            .mockResolvedValue({ id: "obj_xyz", value: storedValue }),
        },
      }),
      vaultNamespace: () => "eleva-v3-main",
    }))
    const { decryptOAuthToken } = await import("./tokens.js")
    const got = await decryptOAuthToken(
      "vault:eleva-v3-main:obj_xyz" as VaultRef
    )
    expect(got.accessToken).toBe("at")
    expect(got.refreshToken).toBeNull()
    expect(got.expiresAt).toEqual(new Date("2026-01-01T00:00:00Z"))
  })
})
