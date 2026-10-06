import { createCipheriv } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EncryptionError } from "./errors"
import {
  __resetKekCacheForTests,
  __setOrgDekStoreForTests,
  createMemoryOrgDekStore,
  currentKekVersion,
  getOrCreateOrgDek,
  loadKekMap,
  shredOrgKeys,
  unwrapDek,
  unwrapOrgDek,
  wrapDek,
} from "./keys"

const ORG_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_ORG = "33333333-3333-4333-8333-333333333333"
const KEK_V1 = Buffer.alloc(32, 1).toString("base64")
const KEK_V3 = Buffer.alloc(32, 3).toString("base64")
const DEK = Buffer.alloc(32, 7)
const AAD = { orgId: ORG_ID, keyVersion: 1 }

function clearKeks() {
  for (const key of Object.keys(process.env)) {
    if (/^ELEVA_KEK_V\d+$/.test(key)) delete process.env[key]
  }
  __resetKekCacheForTests()
}

function installKeks(versions: Record<string, string>) {
  clearKeks()
  Object.assign(process.env, versions)
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (err) {
    return err instanceof EncryptionError ? err.code : "not-encryption-error"
  }
  return undefined
}

beforeEach(() => {
  installKeks({ ELEVA_KEK_V1: KEK_V1 })
  __setOrgDekStoreForTests(createMemoryOrgDekStore())
})

afterEach(() => {
  __setOrgDekStoreForTests(undefined)
  clearKeks()
})

describe("KEK loading", () => {
  it("fails with KEK_MISSING when no ELEVA_KEK_V<n> is set", () => {
    clearKeks()
    expect(errorCode(() => loadKekMap())).toBe("KEK_MISSING")
  })

  it("rejects a KEK that is not 32 bytes", () => {
    installKeks({ ELEVA_KEK_V1: Buffer.alloc(16).toString("base64") })
    expect(errorCode(() => loadKekMap())).toBe("INVALID_KEK")
  })

  it("uses the highest version as current, regardless of env order", () => {
    installKeks({ ELEVA_KEK_V3: KEK_V3, ELEVA_KEK_V1: KEK_V1 })
    expect(currentKekVersion()).toBe(3)
  })

  it("fails with KEK_MISSING when a wrapped DEK names an unset KEK", () => {
    const wrapped = wrapDek(DEK, 1, AAD)
    expect(errorCode(() => unwrapDek(wrapped, 2, AAD))).toBe("KEK_MISSING")
  })
})

describe("DEK wrapping", () => {
  it("round-trips and binds the org and key version", () => {
    const wrapped = wrapDek(DEK, 1, AAD)
    expect(wrapped.startsWith("v2:")).toBe(true)
    expect(unwrapDek(wrapped, 1, AAD).equals(DEK)).toBe(true)
    expect(
      errorCode(() => unwrapDek(wrapped, 1, { ...AAD, keyVersion: 2 }))
    ).toBe("DEK_UNWRAP_FAILED")
    expect(
      errorCode(() => unwrapDek(wrapped, 1, { ...AAD, orgId: OTHER_ORG }))
    ).toBe("DEK_UNWRAP_FAILED")
  })

  it("still unwraps legacy v1 rows that carry no AAD", () => {
    const iv = Buffer.alloc(12, 9)
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(KEK_V1, "base64"),
      iv
    )
    const data = Buffer.concat([cipher.update(DEK), cipher.final()])
    const wrapped = `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`
    expect(unwrapDek(wrapped, 1, AAD).equals(DEK)).toBe(true)
  })

  it.each([
    ["unknown format", "v9:a:b:c"],
    ["missing parts", "v2:a:b"],
    [
      "short iv",
      `v2:${Buffer.alloc(4).toString("base64")}:${Buffer.alloc(16).toString("base64")}:AA==`,
    ],
  ])("rejects %s as INVALID_WRAPPED_DEK", (_label, wrapped) => {
    expect(errorCode(() => unwrapDek(wrapped, 1, AAD))).toBe(
      "INVALID_WRAPPED_DEK"
    )
  })

  it("rejects a stored kek_version that is not a positive integer", () => {
    const row = {
      id: "row",
      orgId: ORG_ID,
      keyVersion: 1,
      kekVersion: "0",
      wrappedDek: wrapDek(DEK, 1, AAD),
      retiredAt: null,
    }
    expect(errorCode(() => unwrapOrgDek(row))).toBe("INVALID_KEK_VERSION")
  })
})

describe("org DEK lifecycle", () => {
  it("returns the same active DEK on repeat calls", async () => {
    const first = await getOrCreateOrgDek(ORG_ID)
    const second = await getOrCreateOrgDek(ORG_ID)
    expect(second.keyVersion).toBe(first.keyVersion)
    expect(second.dek.equals(first.dek)).toBe(true)
  })

  it("creates a fresh DEK after shredding", async () => {
    const before = await getOrCreateOrgDek(ORG_ID)
    await expect(shredOrgKeys(ORG_ID)).resolves.toEqual({ shredded: 1 })
    const after = await getOrCreateOrgDek(ORG_ID)
    expect(after.dek.equals(before.dek)).toBe(false)
  })

  it("keeps DEKs separate per org", async () => {
    const a = await getOrCreateOrgDek(ORG_ID)
    const b = await getOrCreateOrgDek(OTHER_ORG)
    expect(a.dek.equals(b.dek)).toBe(false)
  })
})
