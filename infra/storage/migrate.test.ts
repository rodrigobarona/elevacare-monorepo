import { describe, expect, it, vi } from "vitest"

import {
  isLegacyBlobUrl,
  legacyKey,
  migrate,
  type LegacyStore,
  type PrivateReference,
  type PublicReference,
  type References,
  type TargetStore,
} from "./migrate"

const object = { body: Buffer.from("x"), contentType: "image/jpeg" }
const OLD = "https://abc.public.blob.vercel-storage.com"
const PRIVATE_OLD = "https://abc.private.blob.vercel-storage.com"

function setup(input: {
  legacyPublic?: string[]
  legacyPrivate?: string[]
  listed?: string[] | null
  publicRows?: PublicReference[]
  privateRows?: PrivateReference[]
}) {
  const r2Public = new Set<string>()
  const r2Private = new Set<string>()
  const legacy: LegacyStore = {
    listMediaKeys: async () => input.listed ?? null,
    readPublic: async (key) =>
      input.legacyPublic?.includes(key) ? object : null,
    readPrivate: async (key) =>
      input.legacyPrivate?.includes(key) ? object : null,
  }
  const target: TargetStore = {
    hasPublic: async (key) => r2Public.has(key),
    hasPrivate: async (key) => r2Private.has(key),
    writePublic: async (key) => void r2Public.add(key),
    writePrivate: async (key) => void r2Private.add(key),
  }
  const publicRows = (input.publicRows ?? []).map((row) => ({ ...row }))
  const privateRows = (input.privateRows ?? []).map((row) => ({ ...row }))
  const references: References = {
    publicReferences: async () => publicRows.map((row) => ({ ...row })),
    privateReferences: async () => privateRows.map((row) => ({ ...row })),
    rewritePublic: vi.fn(async (reference, url) => {
      publicRows.find((r) => r.id === reference.id)!.url = url
    }),
    rewritePrivate: vi.fn(async (reference, key) => {
      privateRows.find((r) => r.id === reference.id)!.value = key
    }),
  }
  const run = (apply: boolean, libraryKeys: string[] = []) =>
    migrate({
      apply,
      legacy,
      target,
      references,
      libraryKeys,
      publicUrl: (key) => `https://media.example.com/${key}`,
    })
  return { run, r2Public, r2Private, references, publicRows, privateRows }
}

describe("legacyKey", () => {
  it("maps Blob URLs to keys and leaves keys alone", () => {
    expect(legacyKey(`${PRIVATE_OLD}/dsar/u1/export.zip`)).toBe(
      "dsar/u1/export.zip"
    )
    expect(legacyKey("dsar/u1/export.zip")).toBe("dsar/u1/export.zip")
    expect(isLegacyBlobUrl("https://media.example.com/a.jpg")).toBe(false)
    expect(isLegacyBlobUrl("dsar/u1/export.zip")).toBe(false)
  })
})

describe("migrate", () => {
  const avatar = {
    table: "auth.user.image",
    id: "u1",
    url: `${OLD}/avatar/profile/me.jpg`,
  }
  const dsarUrl = {
    table: "dsar_requests.blob_pathname",
    id: "d1",
    value: `${PRIVATE_OLD}/dsar/u1/export.zip`,
  }
  const dsarKey = {
    table: "dsar_requests.blob_pathname",
    id: "d2",
    value: "dsar/u2/export.zip",
  }

  function full() {
    return setup({
      legacyPublic: ["media/a.jpg", "media/extra.jpg", "avatar/profile/me.jpg"],
      legacyPrivate: ["dsar/u1/export.zip", "dsar/u2/export.zip"],
      listed: ["media/a.jpg", "media/extra.jpg"],
      publicRows: [avatar],
      privateRows: [dsarUrl, dsarKey],
    })
  }

  it("changes nothing on a dry run", async () => {
    const t = full()
    const report = await t.run(false, ["media/a.jpg"])
    expect(t.r2Public.size).toBe(0)
    expect(t.r2Private.size).toBe(0)
    expect(t.references.rewritePublic).not.toHaveBeenCalled()
    expect(t.references.rewritePrivate).not.toHaveBeenCalled()
    expect(report.copied).toEqual({ public: 3, private: 2 })
    expect(report.rewritten).toEqual({ public: 1, private: 1 })
  })

  it("copies listed and library media, then rewrites references", async () => {
    const t = full()
    await t.run(true, ["media/a.jpg"])
    expect([...t.r2Public].sort()).toEqual([
      "avatar/profile/me.jpg",
      "media/a.jpg",
      "media/extra.jpg",
    ])
    expect(t.publicRows[0]?.url).toBe(
      "https://media.example.com/avatar/profile/me.jpg"
    )
    expect(t.privateRows.map((row) => row.value)).toEqual([
      "dsar/u1/export.zip",
      "dsar/u2/export.zip",
    ])
  })

  it("is idempotent: a second run copies and rewrites nothing", async () => {
    const t = full()
    await t.run(true, ["media/a.jpg"])
    const second = await t.run(true, ["media/a.jpg"])
    expect(second.copied).toEqual({ public: 0, private: 0 })
    expect(second.rewritten).toEqual({ public: 0, private: 0 })
    expect(second.alreadyCopied).toEqual({ public: 2, private: 2 })
    expect(second.missing).toEqual([])
  })

  it("resumes after a partial run", async () => {
    const t = full()
    t.r2Private.add("dsar/u1/export.zip")
    const report = await t.run(true, [])
    expect(report.alreadyCopied.private).toBe(1)
    expect(report.copied.private).toBe(1)
    expect(t.privateRows[0]?.value).toBe("dsar/u1/export.zip")
  })

  it("reports a gone private object and still normalises its row", async () => {
    const t = setup({ privateRows: [dsarUrl] })
    const report = await t.run(true)
    expect(report.missing).toEqual([
      { table: "dsar_requests.blob_pathname", id: "d1" },
    ])
    expect(t.privateRows[0]?.value).toBe("dsar/u1/export.zip")
  })

  it("keeps a public URL whose object is gone, and reports it", async () => {
    const t = setup({ publicRows: [avatar] })
    const report = await t.run(true)
    expect(report.missing).toEqual([{ table: "auth.user.image", id: "u1" }])
    expect(t.publicRows[0]?.url).toBe(avatar.url)
  })

  it("ignores references that are not on Blob", async () => {
    const t = setup({
      publicRows: [
        {
          table: "auth.user.image",
          id: "u9",
          url: "https://lh3.googleusercontent.com/a/photo",
        },
      ],
    })
    const report = await t.run(true)
    expect(report.rewritten.public).toBe(0)
    expect(report.missing).toEqual([])
  })

  it("still copies the library when the store cannot be listed", async () => {
    const t = setup({ legacyPublic: ["media/a.jpg"], listed: null })
    const report = await t.run(true, ["media/a.jpg"])
    expect(report.mediaListed).toBe(false)
    expect(t.r2Public.has("media/a.jpg")).toBe(true)
  })
})
