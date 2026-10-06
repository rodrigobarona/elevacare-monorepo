import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EncryptionError } from "./errors"
import {
  __resetKekCacheForTests,
  __setOrgDekStoreForTests,
  createMemoryOrgDekStore,
  shredOrgKeys,
} from "./keys"
import { decryptRecordFields, encryptRecordFields } from "./records"

const ORG_ID = "44444444-4444-4444-8444-444444444444"
const OTHER_ORG = "55555555-5555-4555-8555-555555555555"
const OWNER = { recordId: "record-1" }

function clearKeks() {
  for (const key of Object.keys(process.env)) {
    if (/^ELEVA_KEK_V\d+$/.test(key)) delete process.env[key]
  }
  __resetKekCacheForTests()
}

beforeEach(() => {
  clearKeks()
  process.env.ELEVA_KEK_V1 = Buffer.alloc(32, 1).toString("base64")
  __setOrgDekStoreForTests(createMemoryOrgDekStore())
})

afterEach(() => {
  __setOrgDekStoreForTests(undefined)
  clearKeks()
})

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(EncryptionError)
  expect((err as EncryptionError).code).toBe(code)
}

describe("record field encryption", () => {
  it("does not leak plaintext and seals each field differently", async () => {
    const sealed = await encryptRecordFields(
      ORG_ID,
      { a: "same", b: "same" },
      OWNER
    )
    expect(sealed.a).not.toContain("same")
    expect(sealed.a).not.toBe(sealed.b)
  })

  it("handles an empty field map", async () => {
    await expect(encryptRecordFields(ORG_ID, {}, OWNER)).resolves.toEqual({})
    await expect(decryptRecordFields(ORG_ID, {}, OWNER)).resolves.toEqual({})
  })

  it("binds ciphertext to the owning record", async () => {
    const sealed = await encryptRecordFields(ORG_ID, { note: "x" }, OWNER)
    await expect(
      decryptRecordFields(ORG_ID, sealed, { recordId: "record-2" })
    ).rejects.toBeInstanceOf(EncryptionError)
  })

  it("does not open with another org's keys", async () => {
    const sealed = await encryptRecordFields(ORG_ID, { note: "x" }, OWNER)
    await expectCode(
      decryptRecordFields(OTHER_ORG, sealed, OWNER),
      "KEY_SHREDDED"
    )
  })

  it("is unreadable after the org's keys are shredded", async () => {
    const sealed = await encryptRecordFields(ORG_ID, { note: "x" }, OWNER)
    await shredOrgKeys(ORG_ID)
    await expectCode(decryptRecordFields(ORG_ID, sealed, OWNER), "KEY_SHREDDED")
  })
})
