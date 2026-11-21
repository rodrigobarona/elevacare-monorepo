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

  it("ignores *.draft.json AI draft files", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
      es: { hello: "hola" },
    })
    await writeFile(
      path.join(appsRoot, "web", "messages", "es.draft.json"),
      JSON.stringify({ hello: "borrador", onlyInDraft: "x" })
    )

    const result = await checkI18nParity(appsRoot)
    expect(result.ok).toBe(true)
  })

  it("fails on an empty value or a note left in place of copy", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { title: "Olá", body: "TODO traduzir", cta: " " },
      en: { title: "Hello", body: "Lorem ipsum dolor", cta: "Book" },
      es: { title: "Hola", body: "Todo el equipo", cta: "Reservar" },
    })
    const result = await checkI18nParity(appsRoot)
    const messages = result.issues.map((issue) => issue.message)
    expect(messages).toEqual([
      'key "body" in pt.json is empty or a placeholder (TODO, TBD, FIXME, lorem ipsum)',
      'key "cta" in pt.json is empty or a placeholder (TODO, TBD, FIXME, lorem ipsum)',
      'key "body" in en.json is empty or a placeholder (TODO, TBD, FIXME, lorem ipsum)',
    ])
  })

  it("accepts the everyday word todo in Portuguese and Spanish", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { all: "Todo o dia", heading: "TODO O DIA", list: "Fazer todo: sim" },
      en: { all: "All day", heading: "ALL DAY", list: "Do it all: yes" },
      es: { all: "Todo el día", heading: "TODO EL DÍA", list: "Por todo" },
    })
    // "todo:" reads as a note even inside a sentence: the one accepted miss.
    const result = await checkI18nParity(appsRoot)
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'key "list" in pt.json is empty or a placeholder (TODO, TBD, FIXME, lorem ipsum)',
    ])
  })

  it("catches the usual shapes of a note, also inside a list", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    const messagesDir = path.join(appsRoot, "web", "messages")
    await mkdir(messagesDir, { recursive: true })
    const notes = {
      a: "tbd",
      b: "Todo: write this",
      c: "TODO_copy",
      d: "XXX",
      e: "Needs a FIXME here",
      steps: ["First step", "TODO second step"],
    }
    const real = {
      a: "ok",
      b: "ok",
      c: "ok",
      d: "ok",
      e: "ok",
      steps: ["One", "Two"],
    }
    for (const [locale, messages] of Object.entries({
      pt: notes,
      en: real,
      es: real,
    })) {
      await writeFile(
        path.join(messagesDir, `${locale}.json`),
        JSON.stringify(messages)
      )
    }
    const flagged = (await checkI18nParity(appsRoot)).issues
      .map(
        (issue) =>
          issue.message.match(/key "([^"]+)" in pt\.json is empty/)?.[1]
      )
      .filter(Boolean)
    expect(flagged).toEqual(["a", "b", "c", "d", "e", "steps.1"])
  })

  it("names the retired pt-BR locale when a file for it appears", async () => {
    const appsRoot = await mkdtemp(path.join(tmpdir(), "i18n-parity-"))
    dirs.push(appsRoot)
    await writeAppMessages(appsRoot, "web", {
      pt: { hello: "olá" },
      en: { hello: "hello" },
      es: { hello: "hola" },
      "pt-BR": { hello: "oi" },
    })
    const result = await checkI18nParity(appsRoot)
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "locale file pt-BR.json: pt-BR is retired (D-01); Portuguese lives in pt.json",
    ])
  })
})
