import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { checkI18nParity } from "./i18n-parity"
import { REQUIRED_LOCALES_BY_APP, requiredLocalesForApp } from "./i18n-locales"

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
  locales: Record<string, Record<string, string>>
) {
  const messagesDir = path.join(appsRoot, appName, "messages")
  await mkdir(messagesDir, { recursive: true })
  for (const [locale, messages] of Object.entries(locales)) {
    await writeFile(
      path.join(messagesDir, `${locale}.json`),
      JSON.stringify(messages)
    )
  }
}

describe("REQUIRED_LOCALES_BY_APP", () => {
  it("defaults to pt/en/es and limits admin to pt/en", () => {
    expect([...REQUIRED_LOCALES_BY_APP.default]).toEqual(["pt", "en", "es"])
    expect([...REQUIRED_LOCALES_BY_APP.admin]).toEqual(["pt", "en"])
  })

  it("ignores inherited Object.prototype keys such as toString", () => {
    expect([...requiredLocalesForApp("toString")]).toEqual(["pt", "en", "es"])
    expect([...requiredLocalesForApp("admin")]).toEqual(["pt", "en"])
  })
})

describe("checkI18nParity", () => {
  it("fails when a default-list app is missing es.json", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
    })

    const result = await checkI18nParity(appsRoot)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((issue) => issue.message.includes("es.json"))
    ).toBe(true)
  })

  it("passes when admin omits es because its required list omits es", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "admin", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
    })

    const result = await checkI18nParity(appsRoot)
    expect(result.ok).toBe(true)
  })

  it("fails on a locale file outside the Locale union", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
      es: { hello: "hola" },
      "pt-BR": { hello: "oi" },
    })

    const result = await checkI18nParity(appsRoot)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("pt-BR"))).toBe(
      true
    )
  })

  it("fails when required locale files have different keys", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
      es: { hello: "hola", extra: "x" },
    })

    const result = await checkI18nParity(appsRoot)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("extra"))).toBe(
      true
    )
  })
})
