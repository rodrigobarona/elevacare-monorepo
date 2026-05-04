import { describe, expect, it } from "vitest"
import {
  UploadValidationError,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "./uploads"

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
