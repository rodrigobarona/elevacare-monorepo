import { resetEnvCache } from "@eleva/config/env"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  deletePrivateDocument,
  deletePublicObject,
  getPrivateDocument,
  headPrivateDocument,
  headPublicObject,
  uploadPrivateObject,
  uploadPublicObject,
} from "./index"
import { createUploadUrl, verifyUpload } from "./upload-handler"

/**
 * Exercises the real S3 wire protocol. Skipped unless `R2_INTEGRATION=1`.
 * Reads the normal R2_* env vars: set `R2_ENDPOINT` for MinIO, or leave it
 * unset to prove the same behaviour against real R2 buckets. Writes only under
 * `integration-test/` and deletes what it creates.
 *
 * `R2_INTEGRATION_ORIGIN` additionally checks the bucket CORS rule.
 */
const enabled = process.env.R2_INTEGRATION === "1"
const limits = { allowedContentTypes: ["image/jpeg"], maxBytes: 16 }
const prefix = `integration-test/${Date.now()}`

describe.skipIf(!enabled)("R2 wire protocol", () => {
  const created: string[] = []

  beforeAll(() => {
    resetEnvCache()
    // `.env.local` can set these, which would send private calls to the mock.
    vi.stubEnv("E2E_AUTH_CAPTURE", "0")
    vi.stubEnv("E2E_MOCK_PRIVATE_STORAGE", "0")
  })

  afterAll(async () => {
    try {
      for (const key of created) await deletePrivateDocument(key)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  async function presign(store: "public" | "private", size = 4) {
    const upload = await createUploadUrl({
      ...limits,
      store,
      pathname: `${prefix}/a.jpg`,
      contentType: "image/jpeg",
      size,
    })
    if (store === "private") created.push(upload.pathname)
    return upload
  }

  it("stores, reads and deletes a private object", async () => {
    const { pathname } = await uploadPrivateObject({
      pathname: `${prefix}/doc.pdf`,
      body: Buffer.from("hello"),
      contentType: "application/pdf",
    })
    created.push(pathname)
    expect(await headPrivateDocument(pathname)).toEqual({
      pathname,
      contentType: "application/pdf",
      size: 5,
    })
    const got = await getPrivateDocument(pathname)
    expect(await new Response(got?.stream).text()).toBe("hello")
    await deletePrivateDocument(pathname)
    expect(await headPrivateDocument(pathname)).toBeNull()
    expect(await getPrivateDocument(pathname)).toBeNull()
    await expect(deletePrivateDocument(pathname)).resolves.toBeUndefined()
  })

  it("overwrites only when asked", async () => {
    const pathname = `${prefix}/saft.zip`
    created.push(pathname)
    for (const body of ["first", "second"]) {
      const uploaded = await uploadPrivateObject({
        pathname,
        body: Buffer.from(body),
        contentType: "application/zip",
        overwrite: true,
      })
      expect(uploaded.pathname).toBe(pathname)
    }
    const got = await getPrivateDocument(pathname)
    expect(await new Response(got?.stream).text()).toBe("second")
  })

  it("accepts a presigned PUT with the signed headers", async () => {
    const upload = await presign("private")
    const res = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: upload.headers,
      body: "byte",
    })
    expect(res.status).toBe(200)
    await expect(
      verifyUpload({
        ...limits,
        store: "private",
        pathname: upload.pathname,
      })
    ).resolves.toMatchObject({ contentType: "image/jpeg", size: 4 })
  })

  it("rejects a presigned PUT with a different Content-Type", async () => {
    const upload = await presign("private")
    const res = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: { ...upload.headers, "Content-Type": "text/html" },
      body: "<script>",
    })
    expect(res.status).toBe(403)
    expect(await headPrivateDocument(upload.pathname)).toBeNull()
  })

  it("rejects a presigned PUT without the signed If-None-Match", async () => {
    const upload = await presign("private")
    const res = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: { "Content-Type": "image/jpeg" },
      body: "byte",
    })
    expect(res.ok).toBe(false)
    expect(await headPrivateDocument(upload.pathname)).toBeNull()
  })

  it("refuses to replay a URL over a verified object", async () => {
    const upload = await presign("private")
    const put = (body: string) =>
      fetch(upload.uploadUrl, {
        method: upload.method,
        headers: upload.headers,
        body,
      })
    expect((await put("good")).status).toBe(200)
    expect((await put("this is replaced after review")).status).toBe(412)
    const got = await getPrivateDocument(upload.pathname)
    expect(await new Response(got?.stream).text()).toBe("good")
  })

  it("deletes an oversize upload that lied about its size", async () => {
    const upload = await presign("private", 4)
    const res = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: upload.headers,
      body: "x".repeat(17),
    })
    expect(res.status).toBe(200)
    await expect(
      verifyUpload({
        ...limits,
        store: "private",
        pathname: upload.pathname,
      })
    ).rejects.toMatchObject({ code: "too-large" })
    expect(await headPrivateDocument(upload.pathname)).toBeNull()
  })

  it("keeps the public and private buckets apart", async () => {
    const { pathname, url } = await uploadPublicObject({
      pathname: `${prefix}/public.jpg`,
      body: Buffer.from("pic"),
      contentType: "image/jpeg",
    })
    expect(await headPublicObject(pathname)).toMatchObject({ size: 3 })
    expect(await headPrivateDocument(pathname)).toBeNull()
    await deletePublicObject(url)
    expect(await headPublicObject(pathname)).toBeNull()
  })

  it("leaves foreign URLs alone on public delete", async () => {
    await expect(
      deletePublicObject("https://lh3.googleusercontent.com/a/photo")
    ).resolves.toBeUndefined()
  })

  it.skipIf(!process.env.R2_INTEGRATION_ORIGIN)(
    "answers the browser preflight from the allowed origin",
    async () => {
      const upload = await presign("public")
      const res = await fetch(upload.uploadUrl, {
        method: "OPTIONS",
        headers: {
          Origin: process.env.R2_INTEGRATION_ORIGIN ?? "",
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type,if-none-match",
        },
      })
      expect(res.ok).toBe(true)
      expect(res.headers.get("access-control-allow-origin")).toBe(
        process.env.R2_INTEGRATION_ORIGIN
      )
    }
  )
})
