import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildVaultRef, parseVaultRef, type VaultRef } from "./vault"

describe("vault ref helpers", () => {
  it("builds a ref of the expected shape", () => {
    const ref = buildVaultRef("eleva-v3-main", "obj_abc123")
    expect(ref).toBe("vault:eleva-v3-main:obj_abc123")
  })

  it("parses a well-formed ref round-trip", () => {
    const ref = "vault:eleva-v3-main:obj_abc123" as VaultRef
    const parsed = parseVaultRef(ref)
    expect(parsed).toEqual({
      namespace: "eleva-v3-main",
      objectId: "obj_abc123",
    })
  })

  it("preserves colons in object-id segment", () => {
    const ref = "vault:eleva-v3-main:oauth:google:user_123" as VaultRef
    const parsed = parseVaultRef(ref)
    expect(parsed.namespace).toBe("eleva-v3-main")
    expect(parsed.objectId).toBe("oauth:google:user_123")
  })

  it("throws on malformed ref", () => {
    expect(() => parseVaultRef("not-a-vault-ref")).toThrow(/Invalid vault ref/)
    expect(() => parseVaultRef("vault:")).toThrow()
    expect(() => parseVaultRef("")).toThrow()
  })
})

// Integration tests against the live WorkOS Vault are deferred to S7
// hardening (requires a dedicated test workspace); unit tests above
// cover the pure logic. Crypto primitives inside WorkOS are trusted by
// contract \u2014 see docs/eleva-v3/compliance-data-governance.md.
describe("vault IO (mocked)", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("vaultPut returns a properly shaped ref", async () => {
    vi.doMock("./client.js", () => ({
      workos: () => ({
        vault: {
          createObject: vi.fn().mockResolvedValue({ id: "obj_fake" }),
        },
      }),
      vaultNamespace: () => "eleva-v3-main",
    }))
    const { vaultPut } = await import("./vault.js")
    const ref = await vaultPut("mykey", "secret")
    expect(ref).toBe("vault:eleva-v3-main:obj_fake")
  })

  it("vaultGet reads the plaintext from the returned object", async () => {
    vi.doMock("./client.js", () => ({
      workos: () => ({
        vault: {
          readObject: vi
            .fn()
            .mockResolvedValue({ id: "obj_fake", value: "secret" }),
        },
      }),
      vaultNamespace: () => "eleva-v3-main",
    }))
    const { vaultGet } = await import("./vault.js")
    const plaintext = await vaultGet("vault:eleva-v3-main:obj_fake" as VaultRef)
    expect(plaintext).toBe("secret")
  })

  it("vaultGet rejects when the object has no value", async () => {
    vi.doMock("./client.js", () => ({
      workos: () => ({
        vault: {
          readObject: vi.fn().mockResolvedValue({ id: "obj_fake" }),
        },
      }),
      vaultNamespace: () => "eleva-v3-main",
    }))
    const { vaultGet } = await import("./vault.js")
    await expect(
      vaultGet("vault:eleva-v3-main:obj_fake" as VaultRef)
    ).rejects.toThrow(/no accessible value/)
  })
})
