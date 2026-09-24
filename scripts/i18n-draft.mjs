#!/usr/bin/env node
/**
 * Draft missing locale keys via `@eleva/ai` `translateMessages`.
 *
 * Writes `apps/<app>/messages/<locale>.draft.json` for human review.
 * Does not mutate canonical `*.json` catalogs. Stale drafts fail
 * `pnpm check:i18n-parity` after 14 days.
 *
 * Usage:
 *   pnpm i18n:draft
 *   pnpm i18n:draft -- --dry-run
 *   pnpm i18n:draft -- --app expert
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  planI18nDrafts,
  writeLocaleDraft,
} from "../packages/config/src/i18n-draft.ts"
import { translateMessages } from "../packages/ai/src/translate-messages.ts"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const APPS_ROOT = path.join(ROOT, "apps")
const GLOSSARY_PATH = path.join(ROOT, "packages/config/glossary.json")

function parseArgs(argv) {
  let dryRun = false
  let appFilter
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--") continue
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--app") {
      appFilter = argv[i + 1]
      i += 1
      continue
    }
  }
  return { dryRun, appFilter }
}

async function loadGlossary() {
  const raw = await readFile(GLOSSARY_PATH, "utf8")
  const parsed = JSON.parse(raw)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${GLOSSARY_PATH} must be a JSON object`)
  }
  const glossary = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`${GLOSSARY_PATH}: value for "${key}" must be a string`)
    }
    glossary[key] = value
  }
  return glossary
}

async function main() {
  const { dryRun, appFilter } = parseArgs(process.argv.slice(2))
  let plans = await planI18nDrafts(APPS_ROOT, "en")
  if (appFilter) {
    plans = plans.filter((plan) => plan.app === appFilter)
  }

  if (plans.length === 0) {
    console.log("i18n draft: nothing to draft (no missing keys vs en)")
    return 0
  }

  const glossary = await loadGlossary()
  let wrote = 0

  for (const plan of plans) {
    for (const draft of plan.drafts) {
      console.log(
        `[${plan.app}] ${draft.locale}: ${draft.leafCount} missing key(s)`
      )
      if (dryRun) continue

      const translated = await translateMessages({
        sourceLocale: plan.sourceLocale,
        targetLocales: [draft.locale],
        messages: draft.missing,
        glossary,
      })
      const tree = translated[draft.locale]
      if (!tree) {
        console.error(
          `[${plan.app}] ${draft.locale}: translateMessages returned no tree`
        )
        return 1
      }
      const out = await writeLocaleDraft(
        APPS_ROOT,
        plan.app,
        draft.locale,
        tree
      )
      console.log(`  wrote ${path.relative(ROOT, out)}`)
      wrote += 1
    }
  }

  if (dryRun) {
    console.log("i18n draft: dry-run complete (no files written)")
  } else {
    console.log(
      `i18n draft: wrote ${wrote} draft file(s). Review and promote into canonical locale files before merge.`
    )
  }
  return 0
}

const code = await main()
process.exit(code)
