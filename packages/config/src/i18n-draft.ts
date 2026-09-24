/**
 * i18n draft helpers: missing-key extraction and 14-day draft age gate.
 *
 * AI drafts live as `messages/<locale>.draft.json` with envelope
 * `{ generatedAt, messages }`. Humans promote keys into the canonical
 * locale files. Stale drafts fail `check:i18n-parity` (age from
 * `generatedAt`, not mtime — Git checkouts reset mtime).
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { locales, requiredLocalesForApp, type Locale } from "./i18n-locales"
import type { I18nParityIssue, I18nParityResult } from "./i18n-parity"

/** Drafts older than this must be reviewed or deleted. */
export const I18N_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/** Allow a few minutes of clock skew when rejecting future generatedAt. */
export const I18N_DRAFT_FUTURE_SKEW_MS = 5 * 60 * 1000

const LOCALE_UNION = new Set<string>(locales)

export type MessageTree = { [key: string]: string | MessageTree }

export type I18nDraftEnvelope = {
  generatedAt: string
  messages: MessageTree
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT"
}

export function isDraftFileName(name: string): boolean {
  return name.endsWith(".draft.json")
}

export function draftLocaleFromFileName(name: string): string | null {
  if (!isDraftFileName(name)) return null
  return name.slice(0, -".draft.json".length)
}

function parseJsonObject(
  filePath: string,
  raw: string
): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || valueIsNotObject(parsed)) {
    throw new Error(`${filePath} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}

function valueIsNotObject(value: unknown): boolean {
  return typeof value !== "object" || Array.isArray(value)
}

export function isMessageTree(value: unknown): value is MessageTree {
  if (value === null || valueIsNotObject(value)) return false
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (typeof nested === "string") continue
    if (!isMessageTree(nested)) return false
  }
  return true
}

export function parseDraftEnvelope(
  filePath: string,
  raw: string
): I18nDraftEnvelope {
  const parsed = parseJsonObject(filePath, raw)
  const generatedAt = parsed.generatedAt
  const messages = parsed.messages
  if (
    typeof generatedAt !== "string" ||
    Number.isNaN(Date.parse(generatedAt))
  ) {
    throw new Error(`${filePath} missing valid generatedAt ISO timestamp`)
  }
  if (!isMessageTree(messages)) {
    throw new Error(`${filePath} messages must be a nested string object`)
  }
  return { generatedAt, messages }
}

/**
 * Nested subset of `source` for keys (leaf paths) missing from `target`.
 */
export function collectMissingMessageTree(
  source: MessageTree,
  target: MessageTree
): MessageTree {
  const missing: MessageTree = {}
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key]
    if (typeof sourceValue === "string") {
      if (typeof targetValue !== "string") {
        missing[key] = sourceValue
      }
      continue
    }
    const nestedTarget =
      targetValue !== undefined &&
      typeof targetValue !== "string" &&
      isMessageTree(targetValue)
        ? targetValue
        : {}
    const nestedMissing = collectMissingMessageTree(sourceValue, nestedTarget)
    if (Object.keys(nestedMissing).length > 0) {
      missing[key] = nestedMissing
    }
  }
  return missing
}

/** Deep-merge `patch` into `base` (patch wins on leaf conflicts). */
export function mergeMessageTrees(
  base: MessageTree,
  patch: MessageTree
): MessageTree {
  const out: MessageTree = { ...base }
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = out[key]
    if (typeof patchValue === "string") {
      out[key] = patchValue
      continue
    }
    if (
      baseValue !== undefined &&
      typeof baseValue !== "string" &&
      isMessageTree(baseValue)
    ) {
      out[key] = mergeMessageTrees(baseValue, patchValue)
    } else {
      out[key] = patchValue
    }
  }
  return out
}

export function countMessageLeaves(tree: MessageTree): number {
  let count = 0
  for (const value of Object.values(tree)) {
    if (typeof value === "string") count += 1
    else count += countMessageLeaves(value)
  }
  return count
}

export async function checkI18nDraftAges(
  appsRoot: string,
  options?: { now?: number; maxAgeMs?: number }
): Promise<I18nParityResult> {
  const now = options?.now ?? Date.now()
  const maxAgeMs = options?.maxAgeMs ?? I18N_DRAFT_MAX_AGE_MS
  const issues: I18nParityIssue[] = []
  const apps = await readdir(appsRoot, { withFileTypes: true })

  for (const entry of apps) {
    if (!entry.isDirectory()) continue
    if (entry.name === "poc") continue

    const messagesDir = path.join(appsRoot, entry.name, "messages")
    let files: string[]
    try {
      files = (await readdir(messagesDir)).filter(isDraftFileName)
    } catch {
      continue
    }

    for (const file of files) {
      const locale = draftLocaleFromFileName(file)
      if (!locale || !LOCALE_UNION.has(locale)) {
        issues.push({
          app: entry.name,
          message: `draft file ${file} is outside the Locale union (${locales.join("|")})`,
        })
        continue
      }

      const filePath = path.join(messagesDir, file)
      try {
        const raw = await readFile(filePath, "utf8")
        const envelope = parseDraftEnvelope(filePath, raw)
        const generatedMs = Date.parse(envelope.generatedAt)
        if (generatedMs > now + I18N_DRAFT_FUTURE_SKEW_MS) {
          issues.push({
            app: entry.name,
            message: `draft messages/${file} has generatedAt in the future (${envelope.generatedAt})`,
          })
          continue
        }
        const ageMs = now - generatedMs
        if (ageMs > maxAgeMs) {
          const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
          issues.push({
            app: entry.name,
            message: `draft messages/${file} is ${ageDays} days old (max ${Math.floor(maxAgeMs / (24 * 60 * 60 * 1000))} days) — review and promote keys or delete the draft`,
          })
        }
      } catch (error) {
        issues.push({
          app: entry.name,
          message: `draft messages/${file} is not readable: ${(error as Error).message}`,
        })
      }
    }
  }

  return { ok: issues.length === 0, issues }
}

export type AppDraftPlan = {
  app: string
  sourceLocale: Locale
  drafts: { locale: Locale; missing: MessageTree; leafCount: number }[]
}

async function readOptionalDraftMessages(
  messagesDir: string,
  locale: Locale
): Promise<MessageTree> {
  const draftPath = path.join(messagesDir, `${locale}.draft.json`)
  try {
    const raw = await readFile(draftPath, "utf8")
    return parseDraftEnvelope(draftPath, raw).messages
  } catch (error) {
    if (isNotFound(error)) return {}
    throw error
  }
}

export async function planI18nDrafts(
  appsRoot: string,
  sourceLocale: Locale = "en"
): Promise<AppDraftPlan[]> {
  const plans: AppDraftPlan[] = []
  const apps = await readdir(appsRoot, { withFileTypes: true })

  for (const entry of apps) {
    if (!entry.isDirectory()) continue
    if (entry.name === "poc") continue

    const messagesDir = path.join(appsRoot, entry.name, "messages")
    let files: string[]
    try {
      files = (await readdir(messagesDir)).filter(
        (name) => name.endsWith(".json") && !isDraftFileName(name)
      )
    } catch {
      continue
    }

    const required = requiredLocalesForApp(entry.name)
    if (!required.includes(sourceLocale)) continue

    const present = new Map<string, string>()
    for (const file of files) {
      const locale = file.replace(/\.json$/, "")
      if (LOCALE_UNION.has(locale)) {
        present.set(locale, path.join(messagesDir, file))
      }
    }

    const sourcePath = present.get(sourceLocale)
    if (!sourcePath) continue

    let sourceTree: MessageTree
    try {
      const raw = await readFile(sourcePath, "utf8")
      const parsed = parseJsonObject(sourcePath, raw)
      if (!isMessageTree(parsed)) {
        throw new Error("source must be a nested string object")
      }
      sourceTree = parsed
    } catch {
      continue
    }

    const drafts: AppDraftPlan["drafts"] = []
    for (const locale of required) {
      if (locale === sourceLocale) continue
      const targetPath = present.get(locale)
      let targetTree: MessageTree = {}
      if (targetPath) {
        try {
          const raw = await readFile(targetPath, "utf8")
          const parsed = parseJsonObject(targetPath, raw)
          if (isMessageTree(parsed)) targetTree = parsed
        } catch {
          targetTree = {}
        }
      }
      const existingDraft = await readOptionalDraftMessages(messagesDir, locale)
      // Treat canonical + existing draft keys as already covered so re-runs
      // only translate net-new missing keys (preserves human draft edits).
      const covered = mergeMessageTrees(targetTree, existingDraft)
      const missing = collectMissingMessageTree(sourceTree, covered)
      const leafCount = countMessageLeaves(missing)
      if (leafCount > 0) {
        drafts.push({ locale, missing, leafCount })
      }
    }

    if (drafts.length > 0) {
      plans.push({ app: entry.name, sourceLocale, drafts })
    }
  }

  return plans
}

/**
 * Merge `tree` into an existing draft (if any). Preserves `generatedAt` so
 * the age gate still fires for parked drafts; sets it only on first create.
 */
export async function writeLocaleDraft(
  appsRoot: string,
  app: string,
  locale: Locale,
  tree: MessageTree,
  options?: { now?: Date }
): Promise<string> {
  const filePath = path.join(appsRoot, app, "messages", `${locale}.draft.json`)
  let generatedAt = (options?.now ?? new Date()).toISOString()
  let messages = tree
  try {
    const raw = await readFile(filePath, "utf8")
    const existing = parseDraftEnvelope(filePath, raw)
    generatedAt = existing.generatedAt
    messages = mergeMessageTrees(existing.messages, tree)
  } catch (error) {
    if (!isNotFound(error)) throw error
    // First write — use fresh generatedAt.
  }
  const envelope: I18nDraftEnvelope = { generatedAt, messages }
  await writeFile(filePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8")
  return filePath
}
