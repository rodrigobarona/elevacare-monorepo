import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { checkI18nDraftAges } from "./i18n-draft"
import { locales, requiredLocalesForApp, type Locale } from "./i18n-locales"

const LOCALE_UNION = new Set<string>(locales)

export type I18nParityIssue = {
  app: string
  message: string
}

export type I18nParityResult = {
  ok: boolean
  issues: I18nParityIssue[]
}

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  const keys: string[] = []
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>
  )) {
    const next = prefix ? `${prefix}.${key}` : key
    keys.push(...flattenKeys(nested, next))
  }
  return keys
}

/**
 * A value that is not real copy yet: empty, or a note to self. Checked
 * case-sensitively, so the Portuguese and Spanish word "todo" is fine.
 */
const PLACEHOLDER = /\b(TODO|TBD|FIXME)\b|lorem ipsum/

function placeholderKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return value.trim() === "" ||
      PLACEHOLDER.test(value) ||
      /lorem ipsum/i.test(value)
      ? [prefix]
      : []
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return []
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) =>
      placeholderKeys(nested, prefix ? `${prefix}.${key}` : key)
  )
}

function parseJsonObject(
  filePath: string,
  raw: string
): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}

export async function checkI18nParity(
  appsRoot: string
): Promise<I18nParityResult> {
  const issues: I18nParityIssue[] = []
  const apps = await readdir(appsRoot, { withFileTypes: true })

  for (const entry of apps) {
    if (!entry.isDirectory()) continue
    if (entry.name === "poc") continue

    const messagesDir = path.join(appsRoot, entry.name, "messages")
    let files: string[]
    try {
      // `*.draft.json` is for `pnpm i18n:draft` AI drafts (Phase 04B) — humans
      // review and promote keys into the canonical locale files. Key parity
      // ignores drafts; `checkI18nDraftAges` enforces the 14-day review gate.
      files = (await readdir(messagesDir)).filter(
        (name) => name.endsWith(".json") && !name.endsWith(".draft.json")
      )
    } catch {
      continue
    }

    const required = requiredLocalesForApp(entry.name)
    const present = new Map<string, string>()

    for (const file of files) {
      const locale = file.replace(/\.json$/, "")
      if (!LOCALE_UNION.has(locale)) {
        issues.push({
          app: entry.name,
          message:
            locale.toLowerCase() === "pt-br"
              ? `locale file ${file}: pt-BR is retired (D-01); Portuguese lives in pt.json`
              : `locale file ${file} is outside the Locale union (${locales.join("|")})`,
        })
        continue
      }
      present.set(locale, path.join(messagesDir, file))
    }

    const keySets: { locale: Locale; keys: Set<string> }[] = []

    for (const locale of required) {
      const filePath = present.get(locale)
      if (!filePath) {
        issues.push({
          app: entry.name,
          message: `missing required locale file messages/${locale}.json`,
        })
        continue
      }
      try {
        const raw = await readFile(filePath, "utf8")
        const messages = parseJsonObject(filePath, raw)
        const keys = new Set(flattenKeys(messages))
        keySets.push({ locale, keys })
        for (const key of placeholderKeys(messages)) {
          issues.push({
            app: entry.name,
            message: `key "${key}" in ${locale}.json is empty or a placeholder (TODO, TBD, FIXME, lorem ipsum)`,
          })
        }
      } catch (error) {
        issues.push({
          app: entry.name,
          message: `messages/${locale}.json is not readable or not parseable: ${(error as Error).message}`,
        })
      }
    }

    const baseline = keySets[0]
    if (!baseline || keySets.length < 2) continue

    for (const other of keySets.slice(1)) {
      for (const key of baseline.keys) {
        if (!other.keys.has(key)) {
          issues.push({
            app: entry.name,
            message: `key "${key}" is in ${baseline.locale}.json but missing from ${other.locale}.json`,
          })
        }
      }
      for (const key of other.keys) {
        if (!baseline.keys.has(key)) {
          issues.push({
            app: entry.name,
            message: `key "${key}" is in ${other.locale}.json but missing from ${baseline.locale}.json`,
          })
        }
      }
    }
  }

  return { ok: issues.length === 0, issues }
}

export async function runI18nParityCli(
  appsRoot = path.resolve(import.meta.dirname, "../../../apps"),
  /** Shared packages that ship their own messages (e.g. `@eleva/dashboard`). */
  packagesRoot = path.resolve(import.meta.dirname, "../..")
): Promise<number> {
  const [parity, packages, drafts] = await Promise.all([
    checkI18nParity(appsRoot),
    checkI18nParity(packagesRoot),
    checkI18nDraftAges(appsRoot),
  ])
  const issues = [...parity.issues, ...packages.issues, ...drafts.issues]
  if (issues.length === 0) {
    console.log("i18n parity: ok")
    return 0
  }
  for (const issue of issues) {
    console.error(`[${issue.app}] ${issue.message}`)
  }
  return 1
}
