import { resetEnvCache } from "@eleva/config/env"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  uploadPrivateObject,
  getPrivateDocument,
  deletePrivateDocument,
  headPrivateDocument,
} from "./index"

describe("e2e private storage mock", () => {
  beforeEach(() => {
    resetEnvCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  it("stores and streams without calling R2 when E2E_MOCK_PRIVATE_STORAGE=1", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("E2E_MOCK_PRIVATE_STORAGE", "1")
    const uploaded = await uploadPrivateObject({
      pathname: "dsar/user-1/export.zip",
      body: Buffer.from("PK"),
      contentType: "application/zip",
    })
    expect(uploaded.pathname).toBe("dsar/user-1/export.zip")
    const got = await getPrivateDocument(uploaded.pathname)
    expect(got?.stream).toBeInstanceOf(ReadableStream)
    const meta = await headPrivateDocument(uploaded.pathname)
    expect(meta).toEqual({
      pathname: uploaded.pathname,
      contentType: "application/zip",
      size: 2,
    })
    expect(await headPrivateDocument("dsar/missing.zip")).toBeNull()
    await deletePrivateDocument(uploaded.pathname)
    expect(await getPrivateDocument(uploaded.pathname)).toBeNull()
  })

  it("overwrites a deterministic pathname on repeat uploads", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("E2E_MOCK_PRIVATE_STORAGE", "1")
    const pathname = "invoicing-exports/org-1/saft-2026-03.zip"
    const first = await uploadPrivateObject({
      pathname,
      body: Buffer.from("first"),
      contentType: "application/zip",
      overwrite: true,
    })
    const second = await uploadPrivateObject({
      pathname,
      body: Buffer.from("second"),
      contentType: "application/zip",
      overwrite: true,
    })
    expect(first.pathname).toBe(pathname)
    expect(second.pathname).toBe(pathname)
    const got = await getPrivateDocument(pathname)
    expect(got?.stream).toBeInstanceOf(ReadableStream)
    const text = await new Response(got!.stream).text()
    expect(text).toBe("second")
  })

  it("never mocks when VERCEL_ENV is production", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("E2E_MOCK_PRIVATE_STORAGE", "1")
    vi.stubEnv("E2E_AUTH_CAPTURE", "1")
    vi.stubEnv("R2_ENDPOINT", "")
    vi.stubEnv("R2_PRIVATE_BUCKET", "")
    await expect(
      uploadPrivateObject({
        pathname: "dsar/user-1/export.zip",
        body: Buffer.from("PK"),
        contentType: "application/zip",
      })
    ).rejects.toThrow(/R2_PRIVATE_BUCKET/)
  })
})
