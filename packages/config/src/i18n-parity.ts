import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
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
      files = (await readdir(messagesDir)).filter((name) =>
        name.endsWith(".json")
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
          message: `locale file ${file} is outside the Locale union (${locales.join("|")})`,
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
        const keys = new Set(flattenKeys(parseJsonObject(filePath, raw)))
        keySets.push({ locale, keys })
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
  appsRoot = path.resolve(import.meta.dirname, "../../../apps")
): Promise<number> {
  const result = await checkI18nParity(appsRoot)
  if (result.ok) {
    console.log("i18n parity: ok")
    return 0
  }
  for (const issue of result.issues) {
    console.error(`[${issue.app}] ${issue.message}`)
  }
  return 1
}
