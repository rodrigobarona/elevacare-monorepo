import { S3Client } from "@aws-sdk/client-s3"
import { resetEnvCache } from "@eleva/config/env"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createUploadUrl,
  UPLOAD_URL_TTL_SECONDS,
  UploadRejectedError,
  verifyUpload,
} from "./upload-handler"
import { withRandomSuffix } from "./r2"

const limits = {
  allowedContentTypes: ["image/jpeg", "image/png"],
  maxBytes: 1024,
}

function stubBuckets() {
  vi.stubEnv("R2_ENDPOINT", "")
  vi.stubEnv("R2_ACCOUNT_ID", "acct123")
  vi.stubEnv("R2_PUBLIC_BUCKET", "eleva-public")
  vi.stubEnv("R2_PUBLIC_ACCESS_KEY_ID", "public-key")
  vi.stubEnv("R2_PUBLIC_SECRET_ACCESS_KEY", "public-secret")
  vi.stubEnv("R2_PRIVATE_BUCKET", "eleva-private")
  vi.stubEnv("R2_PRIVATE_ACCESS_KEY_ID", "private-key")
  vi.stubEnv("R2_PRIVATE_SECRET_ACCESS_KEY", "private-secret")
  resetEnvCache()
}

describe("createUploadUrl", () => {
  beforeEach(stubBuckets)

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  async function presign(store: "public" | "private" = "public") {
    const upload = await createUploadUrl({
      ...limits,
      store,
      pathname: "avatar/profile/me.jpg",
      contentType: "image/jpeg",
      size: 10,
    })
    return { upload, url: new URL(upload.uploadUrl) }
  }

  it("targets the EU jurisdiction endpoint in the right bucket", async () => {
    const { url } = await presign()
    expect(url.origin).toBe("https://acct123.eu.r2.cloudflarestorage.com")
    expect(url.pathname).toMatch(
      /^\/eleva-public\/avatar\/profile\/me-[0-9a-f]{32}\.jpg$/
    )
  })

  it("signs with the credentials of the bucket it writes to", async () => {
    const pub = await presign("public")
    const priv = await presign("private")
    expect(pub.url.searchParams.get("X-Amz-Credential")).toMatch(
      /^public-key\//
    )
    expect(priv.url.searchParams.get("X-Amz-Credential")).toMatch(
      /^private-key\//
    )
    expect(priv.url.pathname).toMatch(/^\/eleva-private\//)
  })

  it("signs Content-Type and If-None-Match so neither can be changed", async () => {
    const { upload, url } = await presign()
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-type", "host", "if-none-match"])
    )
    expect(upload.headers).toEqual({
      "Content-Type": "image/jpeg",
      "If-None-Match": "*",
    })
  })

  it("expires after five minutes", async () => {
    const before = Date.now()
    const { upload, url } = await presign()
    expect(url.searchParams.get("X-Amz-Expires")).toBe(
      String(UPLOAD_URL_TTL_SECONDS)
    )
    expect(UPLOAD_URL_TTL_SECONDS).toBe(300)
    expect(new Date(upload.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 300_000
    )
  })

  it("adds no SDK checksum parameters to the URL", async () => {
    const { url } = await presign()
    const names = [...url.searchParams.keys()].map((n) => n.toLowerCase())
    expect(names.filter((n) => n.includes("checksum"))).toEqual([])
  })

  it.each([
    [{ contentType: "image/svg+xml", size: 10 }, "type-not-allowed"],
    [{ contentType: "image/jpeg", size: 1025 }, "too-large"],
    [{ contentType: "image/jpeg", size: 0 }, "empty"],
  ])("rejects %o before signing", async (input, code) => {
    await expect(
      createUploadUrl({
        ...limits,
        store: "public",
        pathname: "avatar/profile/me.jpg",
        ...input,
      })
    ).rejects.toMatchObject({ code })
  })

  it("refuses to run without bucket credentials", async () => {
    vi.stubEnv("R2_PRIVATE_SECRET_ACCESS_KEY", "")
    resetEnvCache()
    await expect(presign("private")).rejects.toThrow(
      /R2_PRIVATE_SECRET_ACCESS_KEY/
    )
  })

  it("refuses R2_ENDPOINT in production", async () => {
    vi.stubEnv("R2_ENDPOINT", "http://127.0.0.1:9100")
    vi.stubEnv("VERCEL_ENV", "production")
    resetEnvCache()
    await expect(presign()).rejects.toThrow(/refused in production/)
  })
})

describe("verifyUpload", () => {
  const send = vi.spyOn(S3Client.prototype, "send")

  beforeEach(() => {
    stubBuckets()
    send.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  function stubHead(result: { ContentType?: string; ContentLength?: number }) {
    send.mockImplementation(async (command: unknown) =>
      (command as object).constructor.name === "HeadObjectCommand" ? result : {}
    )
  }

  function deletes(): number {
    return send.mock.calls.filter(
      ([command]) => command.constructor.name === "DeleteObjectCommand"
    ).length
  }

  const verify = () =>
    verifyUpload({ ...limits, store: "public", pathname: "avatar/profile/a" })

  it("returns the stored metadata without its content-type parameters", async () => {
    stubHead({ ContentType: "image/jpeg; charset=binary", ContentLength: 10 })
    await expect(verify()).resolves.toEqual({
      pathname: "avatar/profile/a",
      contentType: "image/jpeg",
      size: 10,
    })
    expect(deletes()).toBe(0)
  })

  it.each([
    [{ ContentType: "image/jpeg", ContentLength: 1025 }, "too-large"],
    [{ ContentType: "text/html", ContentLength: 10 }, "type-not-allowed"],
    [{ ContentType: "image/jpeg", ContentLength: 0 }, "empty"],
  ])("deletes and rejects %o", async (head, code) => {
    stubHead(head)
    await expect(verify()).rejects.toMatchObject({ code })
    expect(deletes()).toBe(1)
  })

  it("rejects a missing object without a delete", async () => {
    send.mockRejectedValue(
      Object.assign(new Error("NotFound"), {
        $metadata: { httpStatusCode: 404 },
      })
    )
    await expect(verify()).rejects.toBeInstanceOf(UploadRejectedError)
    await expect(verify()).rejects.toMatchObject({ code: "not-found" })
    expect(deletes()).toBe(0)
  })

  it("surfaces store outages instead of treating them as a rejection", async () => {
    send.mockRejectedValue(
      Object.assign(new Error("boom"), { $metadata: { httpStatusCode: 500 } })
    )
    await expect(verify()).rejects.toThrow("boom")
  })
})

describe("withRandomSuffix", () => {
  it("keeps the extension and directory", () => {
    expect(withRandomSuffix("a/b/photo.jpg")).toMatch(
      /^a\/b\/photo-[0-9a-f]{32}\.jpg$/
    )
    expect(withRandomSuffix("a/b.c/photo")).toMatch(
      /^a\/b\.c\/photo-[0-9a-f]{32}$/
    )
    expect(withRandomSuffix("a/.hidden")).toMatch(/^a\/\.hidden-[0-9a-f]{32}$/)
  })
})
