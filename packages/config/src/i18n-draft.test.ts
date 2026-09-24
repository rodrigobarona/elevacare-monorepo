import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import {
  checkI18nDraftAges,
  collectMissingMessageTree,
  I18N_DRAFT_MAX_AGE_MS,
  mergeMessageTrees,
  planI18nDrafts,
  writeLocaleDraft,
} from "./i18n-draft"
import { runI18nParityCli } from "./i18n-parity"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true }))
  )
  dirs.length = 0
})

async function writeAppMessages(
  appsRoot: string,
  appName: string,
  locales: Record<string, Record<string, unknown>>,
  drafts?: Record<
    string,
    { generatedAt: string; messages: Record<string, unknown> }
  >
) {
  const messagesDir = path.join(appsRoot, appName, "messages")
  await mkdir(messagesDir, { recursive: true })
  for (const [locale, messages] of Object.entries(locales)) {
    await writeFile(
      path.join(messagesDir, `${locale}.json`),
      JSON.stringify(messages)
    )
  }
  if (drafts) {
    for (const [locale, envelope] of Object.entries(drafts)) {
      await writeFile(
        path.join(messagesDir, `${locale}.draft.json`),
        JSON.stringify(envelope)
      )
    }
  }
}

describe("collectMissingMessageTree", () => {
  it("returns only keys missing from the target", () => {
    const missing = collectMissingMessageTree(
      {
        shared: "ok",
        nav: { a: "A", b: "B" },
        onlySource: "x",
      },
      {
        shared: "ok",
        nav: { a: "A" },
      }
    )
    expect(missing).toEqual({
      nav: { b: "B" },
      onlySource: "x",
    })
  })
})

describe("mergeMessageTrees", () => {
  it("preserves base leaves and overlays patch", () => {
    expect(
      mergeMessageTrees(
        { a: "1", nest: { x: "x" } },
        { b: "2", nest: { y: "y" } }
      )
    ).toEqual({ a: "1", b: "2", nest: { x: "x", y: "y" } })
  })
})

describe("checkI18nDraftAges", () => {
  it("passes when drafts are fresh by generatedAt", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    await writeAppMessages(
      appsRoot,
      "web",
      {
        pt: { hello: "olá" },
        en: { hello: "hello" },
        es: { hello: "hola" },
      },
      {
        es: {
          generatedAt: new Date().toISOString(),
          messages: { hello: "borrador" },
        },
      }
    )

    const result = await checkI18nDraftAges(appsRoot)
    expect(result.ok).toBe(true)
  })

  it("fails when generatedAt is older than 14 days", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    const staleAt = new Date(
      Date.now() - I18N_DRAFT_MAX_AGE_MS - 60_000
    ).toISOString()
    await writeAppMessages(
      appsRoot,
      "web",
      {
        pt: { hello: "olá" },
        en: { hello: "hello" },
        es: { hello: "hola" },
      },
      {
        es: {
          generatedAt: staleAt,
          messages: { hello: "borrador" },
        },
      }
    )

    const result = await checkI18nDraftAges(appsRoot)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((issue) => issue.message.includes("es.draft.json"))
    ).toBe(true)
  })

  it("fails when generatedAt is in the future", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    const futureAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await writeAppMessages(
      appsRoot,
      "web",
      {
        pt: { hello: "olá" },
        en: { hello: "hello" },
        es: { hello: "hola" },
      },
      {
        es: {
          generatedAt: futureAt,
          messages: { hello: "borrador" },
        },
      }
    )

    const result = await checkI18nDraftAges(appsRoot)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((issue) => issue.message.includes("future"))
    ).toBe(true)
  })

  it("fails when a draft lacks generatedAt", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
      es: { hello: "hola" },
    })
    await writeFile(
      path.join(appsRoot, "web", "messages", "es.draft.json"),
      JSON.stringify({ hello: "legacy-shape" })
    )

    const result = await checkI18nDraftAges(appsRoot)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((issue) => issue.message.includes("generatedAt"))
    ).toBe(true)
  })
})

describe("planI18nDrafts", () => {
  it("plans drafts for keys present in en but missing elsewhere", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      en: { hello: "hello", newKey: "New" },
      pt: { hello: "olá" },
      es: { hello: "hola" },
    })

    const plans = await planI18nDrafts(appsRoot, "en")
    expect(plans).toHaveLength(1)
    expect(plans[0]?.app).toBe("web")
    expect(plans[0]?.drafts.map((d) => d.locale).sort()).toEqual(["es", "pt"])
    expect(plans[0]?.drafts.find((d) => d.locale === "pt")?.missing).toEqual({
      newKey: "New",
    })
    expect(plans[0]?.drafts.find((d) => d.locale === "es")?.missing).toEqual({
      newKey: "New",
    })
  })

  it("skips keys already present in an existing draft", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    await writeAppMessages(
      appsRoot,
      "web",
      {
        en: { hello: "hello", newKey: "New", other: "Other" },
        pt: { hello: "olá" },
        es: { hello: "hola" },
      },
      {
        pt: {
          generatedAt: new Date().toISOString(),
          messages: { newKey: "Novo (human edit)" },
        },
      }
    )

    const plans = await planI18nDrafts(appsRoot, "en")
    const pt = plans[0]?.drafts.find((d) => d.locale === "pt")
    expect(pt?.missing).toEqual({ other: "Other" })
  })
})

describe("writeLocaleDraft", () => {
  it("merges into an existing draft and preserves generatedAt", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    const messagesDir = path.join(appsRoot, "web", "messages")
    await mkdir(messagesDir, { recursive: true })
    const originalAt = "2026-01-01T00:00:00.000Z"
    await writeFile(
      path.join(messagesDir, "pt.draft.json"),
      JSON.stringify({
        generatedAt: originalAt,
        messages: { kept: "Mantido" },
      })
    )

    await writeLocaleDraft(appsRoot, "web", "pt", { added: "Adicionado" })

    const raw = await readFile(path.join(messagesDir, "pt.draft.json"), "utf8")
    const parsed = JSON.parse(raw) as {
      generatedAt: string
      messages: Record<string, string>
    }
    expect(parsed.generatedAt).toBe(originalAt)
    expect(parsed.messages).toEqual({
      kept: "Mantido",
      added: "Adicionado",
    })
  })
})

describe("runI18nParityCli draft age gate", () => {
  it("fails the CLI when a draft is stale even if key parity is ok", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-draft-"))
    dirs.push(appsRoot)
    const staleAt = new Date(
      Date.now() - I18N_DRAFT_MAX_AGE_MS - 60_000
    ).toISOString()
    await writeAppMessages(
      appsRoot,
      "web",
      {
        pt: { hello: "olá" },
        en: { hello: "hello" },
        es: { hello: "hola" },
      },
      {
        es: {
          generatedAt: staleAt,
          messages: { hello: "borrador" },
        },
      }
    )

    const code = await runI18nParityCli(appsRoot)
    expect(code).toBe(1)
  })
})
