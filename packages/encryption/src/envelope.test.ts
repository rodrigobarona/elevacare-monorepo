import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EncryptionError } from "./errors"
import { decryptForOrg, encryptForOrg, parseCiphertext } from "./envelope"
import {
  __resetKekCacheForTests,
  __setOrgDekStoreForTests,
  createMemoryOrgDekStore,
  getOrCreateOrgDek,
  getOrgDek,
  rotateKek,
  shredOrgKeys,
} from "./keys"
import { decryptRecordFields, encryptRecordFields } from "./records"
import { decryptOAuthToken, encryptOAuthToken } from "./tokens"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const KEK_V1 = Buffer.alloc(32, 1).toString("base64")
const KEK_V2 = Buffer.alloc(32, 2).toString("base64")

function installKeks(versions: Record<string, string>) {
  for (const key of Object.keys(process.env)) {
    if (/^ELEVA_KEK_V\d+$/.test(key)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(versions)) {
    process.env[key] = value
  }
  __resetKekCacheForTests()
}

beforeEach(() => {
  installKeks({ ELEVA_KEK_V1: KEK_V1 })
  __setOrgDekStoreForTests(createMemoryOrgDekStore())
})

afterEach(() => {
  __setOrgDekStoreForTests(undefined)
  __resetKekCacheForTests()
  for (const key of Object.keys(process.env)) {
    if (/^ELEVA_KEK_V\d+$/.test(key)) delete process.env[key]
  }
})

describe("envelope encryption", () => {
  it("round-trips a known plaintext", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "hello member")
    expect(ciphertext.startsWith("v1:1:1:")).toBe(true)
    await expect(decryptForOrg(ORG_ID, ciphertext)).resolves.toBe(
      "hello member"
    )
  })

  it("rejects ciphertext with a short IV", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "secret")
    const parsed = parseCiphertext(ciphertext)
    const shortIv = [
      "v1",
      "1",
      "1",
      Buffer.alloc(4).toString("base64"),
      parsed.tag.toString("base64"),
      parsed.data.toString("base64"),
    ].join(":")
    expect(() => parseCiphertext(shortIv)).toThrowError(/INVALID_CIPHERTEXT/)
  })

  it("rejects Vault-era ciphertext", async () => {
    await expect(
      decryptForOrg(ORG_ID, "vault:secret-ref")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CIPHERTEXT" })
  })

  it("rejects tampered ciphertext", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "secret")
    const parsed = parseCiphertext(ciphertext)
    const tamperedData = Buffer.from(parsed.data)
    tamperedData[0] = (tamperedData[0] ?? 0) ^ 0xff
    const tampered = [
      "v1",
      "1",
      "1",
      parsed.iv.toString("base64"),
      parsed.tag.toString("base64"),
      tamperedData.toString("base64"),
    ].join(":")
    await expect(decryptForOrg(ORG_ID, tampered)).rejects.toMatchObject({
      code: "DECRYPT_FAILED",
    })
  })

  it("binds optional AAD", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "notes", "booking:1")
    await expect(decryptForOrg(ORG_ID, ciphertext, "booking:1")).resolves.toBe(
      "notes"
    )
    await expect(
      decryptForOrg(ORG_ID, ciphertext, "booking:2")
    ).rejects.toBeInstanceOf(EncryptionError)
  })

  it("stays readable after KEK rotate", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "keep-me")
    expect(parseCiphertext(ciphertext).kekVersion).toBe(1)
    process.env.ELEVA_KEK_V2 = KEK_V2
    __resetKekCacheForTests()
    await rotateKek(ORG_ID)
    await expect(decryptForOrg(ORG_ID, ciphertext)).resolves.toBe("keep-me")
  })

  it("throws KEY_SHREDDED after shredOrgKeys", async () => {
    const ciphertext = await encryptForOrg(ORG_ID, "phi")
    await shredOrgKeys(ORG_ID)
    await expect(decryptForOrg(ORG_ID, ciphertext)).rejects.toMatchObject({
      code: "KEY_SHREDDED",
    })
  })

  it("getOrCreateOrgDek is race-safe", async () => {
    const [first, second] = await Promise.all([
      getOrCreateOrgDek(ORG_ID),
      getOrCreateOrgDek(ORG_ID),
    ])
    expect(first.id).toBe(second.id)
    expect(first.keyVersion).toBe(1)
    expect(first.dek.equals(second.dek)).toBe(true)
  })
})

describe("record field helpers", () => {
  it("encrypts and decrypts named fields", async () => {
    const encrypted = await encryptRecordFields(ORG_ID, {
      transcript: "session notes",
      report: "labs",
    })
    expect(encrypted.transcript).not.toBe("session notes")
    const decrypted = await decryptRecordFields(ORG_ID, encrypted)
    expect(decrypted).toEqual({ transcript: "session notes", report: "labs" })
  })

  it("rejects swapped field ciphertexts", async () => {
    const encrypted = await encryptRecordFields(ORG_ID, {
      transcript: "session notes",
      report: "labs",
    })
    await expect(
      decryptRecordFields(ORG_ID, {
        transcript: encrypted.report ?? "",
        report: encrypted.transcript ?? "",
      })
    ).rejects.toBeInstanceOf(EncryptionError)
  })

  it("throws UNKNOWN_DEK_VERSION when the org still has keys", async () => {
    await getOrCreateOrgDek(ORG_ID)
    await expect(getOrgDek(ORG_ID, 99)).rejects.toMatchObject({
      code: "UNKNOWN_DEK_VERSION",
    })
  })
})

describe("oauth token helpers", () => {
  it("round-trips expiresAt as Date", async () => {
    const ciphertext = await encryptOAuthToken({
      provider: "toconline",
      userId: "user_1",
      orgId: ORG_ID,
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    })
    const got = await decryptOAuthToken(ORG_ID, ciphertext)
    expect(got.accessToken).toBe("at")
    expect(got.refreshToken).toBe("rt")
    expect(got.expiresAt).toEqual(new Date("2026-01-01T00:00:00Z"))
  })
})
