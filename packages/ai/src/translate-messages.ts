/**
 * Message-catalog drafting (Phase 4B). Translates nested next-intl JSON trees
 * for human review — never ships drafts unreviewed (README section 4 rule 10).
 */

import { generateText } from "ai"
import glossaryJson from "@eleva/config/glossary.json"

import { assertApprovedModel } from "./approved-models"
import { resolveEditorModelId } from "./editor-assist"

export type MessageTree = { [key: string]: string | MessageTree }

export type TranslateMessagesInput = {
  sourceLocale: string
  targetLocales: readonly string[]
  messages: MessageTree
  glossary?: Record<string, string>
}

export type TranslateMessagesResult = Record<string, MessageTree>

export const AI_TRANSLATE_MESSAGES_EMPTY =
  "AI_TRANSLATE_MESSAGES_EMPTY" as const
export const AI_TRANSLATE_MESSAGES_PARSE =
  "AI_TRANSLATE_MESSAGES_PARSE" as const

export class AiTranslateMessagesEmptyError extends Error {
  readonly code = AI_TRANSLATE_MESSAGES_EMPTY

  constructor() {
    super("translateMessages requires a non-empty messages tree")
    this.name = "AiTranslateMessagesEmptyError"
  }
}

export class AiTranslateMessagesParseError extends Error {
  readonly code = AI_TRANSLATE_MESSAGES_PARSE

  constructor(detail: string) {
    super(`translateMessages could not parse model JSON: ${detail}`)
    this.name = "AiTranslateMessagesParseError"
  }
}

export const DEFAULT_GLOSSARY: Record<string, string> = glossaryJson

function isMessageTree(value: unknown): value is MessageTree {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (typeof nested === "string") continue
    if (!isMessageTree(nested)) return false
  }
  return true
}

function countLeaves(tree: MessageTree): number {
  let count = 0
  for (const value of Object.values(tree)) {
    if (typeof value === "string") count += 1
    else count += countLeaves(value)
  }
  return count
}

export function buildTranslateMessagesPrompt(
  input: TranslateMessagesInput & { targetLocale: string }
): string {
  const glossary = { ...DEFAULT_GLOSSARY, ...input.glossary }
  const glossaryLines = Object.entries(glossary)
    .map(([term, keep]) => `- "${term}" → keep as "${keep}"`)
    .join("\n")

  return [
    "You translate Eleva product UI strings for next-intl message catalogs.",
    "Return ONLY a JSON object with the same keys and nesting as the input.",
    "Preserve ICU placeholders exactly (e.g. {name}, {count, plural, ...}).",
    "Use plain language. Prefer 'members' over 'patients' or 'users'.",
    "Prefer 'Space' for personal organizations. Never invent clinical claims.",
    `Source locale: ${input.sourceLocale}`,
    `Target locale: ${input.targetLocale}`,
    "Fixed glossary terms (do not translate these tokens when they appear):",
    glossaryLines,
    "",
    "Messages JSON:",
    JSON.stringify(input.messages, null, 2),
  ].join("\n")
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  return JSON.parse(candidate) as unknown
}

/**
 * Keep only source leaf paths from model output; throw if a leaf is missing.
 */
export function projectToSourceShape(
  source: MessageTree,
  output: MessageTree,
  prefix = ""
): MessageTree {
  const out: MessageTree = {}
  for (const [key, value] of Object.entries(source)) {
    const got = output[key]
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      if (typeof got !== "string") {
        throw new AiTranslateMessagesParseError(`missing key ${path}`)
      }
      out[key] = got
    } else {
      if (!got || typeof got === "string" || !isMessageTree(got)) {
        throw new AiTranslateMessagesParseError(`missing subtree ${path}`)
      }
      out[key] = projectToSourceShape(value, got, path)
    }
  }
  return out
}

/**
 * Translate a nested message tree into each target locale via the AI Gateway.
 * Callers write results to `messages/<locale>.draft.json` for human review.
 */
export async function translateMessages(
  input: TranslateMessagesInput,
  options?: {
    generate?: typeof generateText
    env?: NodeJS.ProcessEnv
    maxOutputTokens?: number
  }
): Promise<TranslateMessagesResult> {
  if (countLeaves(input.messages) === 0) {
    throw new AiTranslateMessagesEmptyError()
  }
  if (input.targetLocales.length === 0) {
    return {}
  }

  const modelId = resolveEditorModelId(options?.env ?? process.env)
  assertApprovedModel(modelId)
  const generate = options?.generate ?? generateText
  const result: TranslateMessagesResult = {}

  for (const targetLocale of input.targetLocales) {
    const prompt = buildTranslateMessagesPrompt({ ...input, targetLocale })
    const { text } = await generate({
      model: modelId,
      prompt,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
    })

    let parsed: unknown
    try {
      parsed = extractJsonObject(text)
    } catch (error) {
      throw new AiTranslateMessagesParseError((error as Error).message)
    }
    if (!isMessageTree(parsed)) {
      throw new AiTranslateMessagesParseError("expected a nested string object")
    }
    result[targetLocale] = projectToSourceShape(input.messages, parsed)
  }

  return result
}
