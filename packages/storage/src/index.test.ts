import { afterEach, describe, expect, it, vi } from "vitest"
import {
  UploadValidationError,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  uploadPrivateBlob,
  getPrivateDocument,
  deletePrivateDocument,
} from "./index"

describe("upload validation constants", () => {
  it("accepts pdf and common image types", () => {
    expect(ALLOWED_DOCUMENT_MIME_TYPES.has("application/pdf")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIME_TYPES.has("image/jpeg")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIME_TYPES.has("image/png")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIME_TYPES.has("image/webp")).toBe(true)
  })

  it("rejects executable / archive / arbitrary types", () => {
    for (const bad of [
      "application/octet-stream",
      "application/zip",
      "application/x-msdownload",
      "text/html",
      "application/javascript",
    ]) {
      expect(ALLOWED_DOCUMENT_MIME_TYPES.has(bad)).toBe(false)
    }
  })

  it("caps documents at 10MiB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe("UploadValidationError", () => {
  it("carries machine-readable code", () => {
    const err = new UploadValidationError("too-large", "boom")
    expect(err.code).toBe("too-large")
    expect(err.name).toBe("UploadValidationError")
    expect(err).toBeInstanceOf(Error)
  })
})

describe("e2e private blob mock", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("stores and streams without calling Vercel when E2E_MOCK_PRIVATE_BLOB=1", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("E2E_MOCK_PRIVATE_BLOB", "1")
    const uploaded = await uploadPrivateBlob({
      pathname: "dsar/user-1/export.zip",
      body: Buffer.from("PK"),
      contentType: "application/zip",
    })
    expect(uploaded.url).toMatch(/^e2e-private:\/\//)
    expect(uploaded.pathname).toBe("dsar/user-1/export.zip")
    const got = await getPrivateDocument(uploaded.url)
    expect(got?.stream).toBeInstanceOf(ReadableStream)
    const byPath = await getPrivateDocument(uploaded.pathname)
    expect(byPath?.stream).toBeInstanceOf(ReadableStream)
    await deletePrivateDocument(uploaded.url)
    expect(await getPrivateDocument(uploaded.url)).toBeNull()
  })
})
