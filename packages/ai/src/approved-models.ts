/**
 * AI model allow-list (ADR-023 / Phase 4B). Fail closed: unknown model ids throw.
 * A model qualifies only if the AI Gateway lists a provider for it that has
 * zero data retention and serves the EU zone (`/v1/models/{id}/endpoints`:
 * `has_zdr: true` plus an `inference_regions` entry with `geo_region: "eu"`).
 */

export type ApprovedModel = {
  modelId: string
  provider: string
  evidenceUrl: string
}

export const AI_MODEL_NOT_APPROVED = "AI_MODEL_NOT_APPROVED" as const

export class AiModelNotApprovedError extends Error {
  readonly code = AI_MODEL_NOT_APPROVED

  constructor(modelId: string) {
    super(`Model is not on the approved allow-list: ${modelId}`)
    this.name = "AiModelNotApprovedError"
  }
}

export const APPROVED_MODELS: readonly ApprovedModel[] = [
  {
    modelId: "openai/gpt-6-luna",
    provider: "vercel-ai-gateway",
    evidenceUrl:
      "https://ai-gateway.vercel.sh/v1/models/openai/gpt-6-luna/endpoints",
  },
] as const

/**
 * Gateway options for every call: only zero-data-retention providers, with
 * inference (and anything the provider keeps at rest) in the EU. If no
 * provider meets both, the gateway fails the request instead of relaxing
 * either constraint.
 */
export const GATEWAY_PROVIDER_OPTIONS = {
  gateway: {
    zeroDataRetention: true,
    inferenceRegion: { scope: "zone", geoRegion: "eu" },
  },
} as const

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
