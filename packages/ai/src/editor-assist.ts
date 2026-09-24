/**
 * Editor writing assistance (ADR-023 / Phase 4B).
 * Streams through the Vercel AI Gateway; model pinned by
 * `AI_GATEWAY_MODEL_EDITOR` and gated by `assertApprovedModel`.
 */

import { streamText } from "ai"

import { assertApprovedModel } from "./approved-models"

export const EDITOR_ASSIST_COMMANDS = [
  "improve",
  "shorten",
  "fix_grammar",
  "translate",
] as const

export type EditorAssistCommand = (typeof EDITOR_ASSIST_COMMANDS)[number]

export const EDITOR_ASSIST_CONTEXTS = ["marketing", "clinical"] as const

export type EditorAssistContext = (typeof EDITOR_ASSIST_CONTEXTS)[number]

export const AI_CLINICAL_CONTEXT_REJECTED =
  "AI_CLINICAL_CONTEXT_REJECTED" as const
export const AI_MODEL_ENV_MISSING = "AI_MODEL_ENV_MISSING" as const
export const AI_TRANSLATE_LOCALE_REQUIRED =
  "AI_TRANSLATE_LOCALE_REQUIRED" as const

export class AiClinicalContextRejectedError extends Error {
  readonly code = AI_CLINICAL_CONTEXT_REJECTED

  constructor() {
    super(
      "Clinical AI context is not enabled until Phase 10 (zero-retention models)"
    )
    this.name = "AiClinicalContextRejectedError"
  }
}

export class AiModelEnvMissingError extends Error {
  readonly code = AI_MODEL_ENV_MISSING

  constructor() {
    super("AI_GATEWAY_MODEL_EDITOR is not set")
    this.name = "AiModelEnvMissingError"
  }
}

export class AiTranslateLocaleRequiredError extends Error {
  readonly code = AI_TRANSLATE_LOCALE_REQUIRED

  constructor() {
    super("translate requires sourceLocale and targetLocale")
    this.name = "AiTranslateLocaleRequiredError"
  }
}

export type EditorAssistInput = {
  command: EditorAssistCommand
  text: string
  sourceLocale?: string
  targetLocale?: string
  context: EditorAssistContext
}

export type EditorAssistStream = ReturnType<typeof streamText>

const COMMAND_INSTRUCTIONS: Record<EditorAssistCommand, string> = {
  improve:
    "Improve clarity and flow while preserving meaning and factual claims. Return only the revised text.",
  shorten:
    "Shorten the text without losing essential meaning. Return only the revised text.",
  fix_grammar:
    "Fix grammar, spelling, and punctuation. Preserve tone and meaning. Return only the revised text.",
  translate:
    "Translate the text accurately. Preserve formatting markers. Return only the translated text.",
}

/**
 * Resolve and allow-list the pinned editor model. Fail closed when the env
 * var is missing or the model is not on `APPROVED_MODELS`.
 */
export function resolveEditorModelId(
  env: NodeJS.ProcessEnv = process.env
): string {
  const modelId = env.AI_GATEWAY_MODEL_EDITOR?.trim()
  if (!modelId) {
    throw new AiModelEnvMissingError()
  }
  return assertApprovedModel(modelId).modelId
}

export function buildEditorAssistPrompt(input: EditorAssistInput): string {
  const instruction = COMMAND_INSTRUCTIONS[input.command]
  const localeHint =
    input.command === "translate"
      ? `\nSource locale: ${input.sourceLocale}\nTarget locale: ${input.targetLocale}`
      : input.sourceLocale
        ? `\nLocale: ${input.sourceLocale}`
        : ""

  return [
    "You are Eleva's marketing copy assistant for expert bios and service descriptions.",
    "Use plain language. Prefer 'members' over 'patients' or 'users'. Prefer 'Space' for personal organizations.",
    "Do not invent clinical claims, diagnoses, or guarantees.",
    instruction + localeHint,
    "",
    "Text:",
    input.text,
  ].join("\n")
}

export function assertEditorAssistInput(input: EditorAssistInput): void {
  if (input.context === "clinical") {
    throw new AiClinicalContextRejectedError()
  }
  if (input.command === "translate") {
    if (!input.sourceLocale?.trim() || !input.targetLocale?.trim()) {
      throw new AiTranslateLocaleRequiredError()
    }
  }
}

/**
 * Start a streaming assist call. Callers must consume the stream
 * (e.g. `toTextStreamResponse()`). Does not log prompt/completion text.
 */
export function editorAssist(
  input: EditorAssistInput,
  options?: {
    onFinish?: NonNullable<Parameters<typeof streamText>[0]["onFinish"]>
    abortSignal?: AbortSignal
    maxOutputTokens?: number
  }
): EditorAssistStream {
  assertEditorAssistInput(input)
  const modelId = resolveEditorModelId()
  const prompt = buildEditorAssistPrompt(input)

  return streamText({
    model: modelId,
    prompt,
    abortSignal: options?.abortSignal,
    maxOutputTokens: options?.maxOutputTokens ?? 2048,
    onFinish: options?.onFinish,
  })
}
