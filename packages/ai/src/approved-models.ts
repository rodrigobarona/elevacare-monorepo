/**
 * AI model allow-list (ADR-023 / Phase 4B). Fail closed: unknown model ids throw.
 * Phase 10 requires `zeroRetention: true` for PHI / clinical context.
 */

export type ApprovedModel = {
  modelId: string
  provider: string
  zeroRetention: boolean
  evidenceUrl: string
}

export const AI_MODEL_NOT_APPROVED = "AI_MODEL_NOT_APPROVED" as const
export const AI_MODEL_ZERO_RETENTION_REQUIRED =
  "AI_MODEL_ZERO_RETENTION_REQUIRED" as const

export class AiModelNotApprovedError extends Error {
  readonly code = AI_MODEL_NOT_APPROVED

  constructor(modelId: string) {
    super(`Model is not on the approved allow-list: ${modelId}`)
    this.name = "AiModelNotApprovedError"
  }
}

export class AiModelZeroRetentionRequiredError extends Error {
  readonly code = AI_MODEL_ZERO_RETENTION_REQUIRED

  constructor(modelId: string) {
    super(`Model is approved but lacks zero-retention: ${modelId}`)
    this.name = "AiModelZeroRetentionRequiredError"
  }
}

/**
 * Seed allow-list for editor assist. Replace evidence URLs when legal confirms
 * the vendor zero-retention attestation for each model.
 */
export const APPROVED_MODELS: readonly ApprovedModel[] = [
  {
    modelId: "openai/gpt-4.1-mini",
    provider: "vercel-ai-gateway",
    zeroRetention: false,
    evidenceUrl: "https://vercel.com/docs/ai-gateway",
  },
] as const

const APPROVED_BY_ID = new Map(
  APPROVED_MODELS.map((model) => [model.modelId, model] as const)
)

export function assertApprovedModel(modelId: string): ApprovedModel {
  const model = APPROVED_BY_ID.get(modelId)
  if (!model) {
    throw new AiModelNotApprovedError(modelId)
  }
  return model
}

export function requireZeroRetentionModel(modelId: string): ApprovedModel {
  const model = assertApprovedModel(modelId)
  if (!model.zeroRetention) {
    throw new AiModelZeroRetentionRequiredError(modelId)
  }
  return model
}
