import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createLegacyBlobStore } from "./legacy-blob-store"

const PUBLIC_TOKEN = "vercel_blob_rw_store1_public"
const PRIVATE_TOKEN = "vercel_blob_rw_store1_private"

describe("createLegacyBlobStore", () => {
  let server: Server
  let base: string

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "", "http://local")
      if (url.pathname === "/api/blob") {
        const authorized =
          req.headers.authorization === `Bearer ${PUBLIC_TOKEN}` &&
          req.headers["x-api-version"] === "12" &&
          url.searchParams.get("prefix") === "media/"
        if (!authorized) return void res.writeHead(403).end()
        const second = url.searchParams.get("cursor") === "next"
        res.writeHead(200, { "content-type": "application/json" })
        return void res.end(
          JSON.stringify(
            second
              ? { blobs: [{ pathname: "media/b.jpg" }], hasMore: false }
              : {
                  blobs: [{ pathname: "media/a.jpg" }],
                  hasMore: true,
                  cursor: "next",
                }
          )
        )
      }
      if (url.pathname === "/public/media/a%20b.jpg") {
        res.writeHead(200, { "content-type": "image/jpeg" })
        return void res.end("public-bytes")
      }
      if (url.pathname === "/public/down.jpg") {
        return void res.writeHead(503).end()
      }
      if (url.pathname === "/private/dsar/u1/export.zip") {
        if (req.headers.authorization !== `Bearer ${PRIVATE_TOKEN}`) {
          return void res.writeHead(403).end()
        }
        res.writeHead(200, { "content-type": "application/zip" })
        return void res.end("private-bytes")
      }
      res.writeHead(404).end()
    })
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve())
    )
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.close()
  })

  function store() {
    return createLegacyBlobStore({
      publicToken: PUBLIC_TOKEN,
      privateToken: PRIVATE_TOKEN,
      publicBase: `${base}/public`,
      privateBase: `${base}/private`,
      listApi: `${base}/api/blob`,
    })
  }

  it("lists every page of media keys", async () => {
    await expect(store().listMediaKeys()).resolves.toEqual([
      "media/a.jpg",
      "media/b.jpg",
    ])
  })

  it("skips listing without a token", async () => {
    await expect(createLegacyBlobStore({}).listMediaKeys()).resolves.toBeNull()
  })

  it("reads public objects and keeps their content type", async () => {
    const object = await store().readPublic("media/a b.jpg")
    expect(object?.contentType).toBe("image/jpeg")
    expect(object?.body.toString()).toBe("public-bytes")
  })

  it("reads private objects with the bearer token", async () => {
    const object = await store().readPrivate("dsar/u1/export.zip")
    expect(object?.body.toString()).toBe("private-bytes")
  })

  it("treats 404 as missing but fails on other errors", async () => {
    await expect(store().readPublic("media/gone.jpg")).resolves.toBeNull()
    await expect(store().readPublic("down.jpg")).rejects.toThrow("503")
  })

  it("derives the private host from the token", async () => {
    await expect(
      createLegacyBlobStore({ privateToken: "malformed" }).readPrivate("a")
    ).rejects.toThrow("malformed")
  })

  it("refuses private reads without a token", async () => {
    await expect(createLegacyBlobStore({}).readPrivate("a")).rejects.toThrow(
      "BLOB_PRIVATE_READ_WRITE_TOKEN"
    )
  })
})
