import { generateObject } from "ai"

import {
  GATEWAY_PROVIDER_OPTIONS,
  requireZeroRetentionModel,
} from "./approved-models"
import { AiModelEnvMissingError } from "./editor-assist"
import {
  assertZeroRetentionRoutingOptions,
  attestZeroRetentionEu,
} from "./zero-retention-attestation"
import {
  buildSessionReportPrompt,
  formatSessionReportDraftBody,
  SESSION_REPORT_PROMPT_VERSION,
  SessionReportDraftSchema,
  type SessionReportDraft,
} from "./prompts/session-report.v1"

export { SESSION_REPORT_DRAFT_OUTPUT_KEYS } from "./prompts/session-report.v1"

export function resolveSessionReportModelId(
  env: NodeJS.ProcessEnv = process.env
): string {
  const modelId = env.AI_GATEWAY_MODEL_SESSION_REPORT?.trim()
  if (!modelId) {
    throw new AiModelEnvMissingError()
  }
  requireZeroRetentionModel(modelId)
  return modelId
}

export type SessionReportGenerationInput = {
  locale: string
  noteTexts: string[]
  intakeText?: string
}

export type SessionReportGenerationResult = {
  draft: SessionReportDraft
  body: string
  modelId: string
  promptVersion: typeof SESSION_REPORT_PROMPT_VERSION
  usage?: { promptTokens?: number; completionTokens?: number }
}

type GenerateObjectFn = typeof generateObject

export async function generateSessionReportDraft(
  input: SessionReportGenerationInput,
  options?: {
    generateObject?: GenerateObjectFn
    /** Defaults to the live gateway attestation; tests inject a stub. */
    attestZeroRetention?: (modelId: string) => Promise<unknown>
  }
): Promise<SessionReportGenerationResult> {
  const modelId = resolveSessionReportModelId()
  // Fail closed before any PHI is built into a prompt or sent.
  assertZeroRetentionRoutingOptions(GATEWAY_PROVIDER_OPTIONS)
  await (options?.attestZeroRetention ?? attestZeroRetentionEu)(modelId)
  const { system, user } = buildSessionReportPrompt(input)
  const generate = options?.generateObject ?? generateObject

  const result = await generate({
    model: modelId,
    schema: SessionReportDraftSchema,
    system,
    prompt: user,
    providerOptions: GATEWAY_PROVIDER_OPTIONS,
  })

  const draft = SessionReportDraftSchema.parse(result.object)
  return {
    draft,
    body: formatSessionReportDraftBody(draft),
    modelId,
    promptVersion: SESSION_REPORT_PROMPT_VERSION,
    usage: {
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
    },
  }
}
