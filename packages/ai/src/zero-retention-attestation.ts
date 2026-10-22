import {
  AiModelZeroRetentionRequiredError,
  GATEWAY_PROVIDER_OPTIONS,
  requireZeroRetentionModel,
} from "./approved-models"

/**
 * Fail-closed attestation that the AI Gateway still lists a provider for the
 * model that has zero data retention AND serves the EU zone. The allow-list in
 * `approved-models.ts` is a point-in-time claim; this checks the gateway's
 * live endpoint listing (the `evidenceUrl`) before PHI leaves the building, so
 * a provider that drops ZDR or EU inference stops clinical drafts instead of
 * silently relaxing the guarantee.
 */

export type ZeroRetentionAttestation = {
  modelId: string
  provider: string
  checkedAt: Date
}

type EndpointListing = {
  provider_name?: unknown
  has_zdr?: unknown
  inference_regions?: unknown
}

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export const ZERO_RETENTION_ATTESTATION_TTL_MS = 6 * 60 * 60 * 1000
const ATTESTATION_TIMEOUT_MS = 5_000

const cache = new Map<string, ZeroRetentionAttestation>()

export function resetZeroRetentionAttestationCacheForTests(): void {
  cache.clear()
}

function qualifyingProvider(listing: unknown): string | null {
  if (!listing || typeof listing !== "object") return null
  const endpoints = (listing as { data?: { endpoints?: unknown } }).data
    ?.endpoints
  if (!Array.isArray(endpoints)) return null
  for (const raw of endpoints as EndpointListing[]) {
    if (raw?.has_zdr !== true) continue
    const regions = Array.isArray(raw.inference_regions)
      ? (raw.inference_regions as { geo_region?: unknown }[])
      : []
    if (regions.some((region) => region?.geo_region === "eu")) {
      return typeof raw.provider_name === "string"
        ? raw.provider_name
        : "unknown"
    }
  }
  return null
}

/** The options actually sent must still carry both constraints. */
export function assertZeroRetentionRoutingOptions(
  providerOptions: unknown = GATEWAY_PROVIDER_OPTIONS
): void {
  const gateway = (providerOptions as { gateway?: Record<string, unknown> })
    ?.gateway
  const region = gateway?.inferenceRegion as
    | { scope?: unknown; geoRegion?: unknown }
    | undefined
  if (gateway?.zeroDataRetention !== true || region?.geoRegion !== "eu") {
    throw new AiModelZeroRetentionRequiredError("routing-options")
  }
}

export async function attestZeroRetentionEu(
  modelId: string,
  options?: { fetchImpl?: FetchLike; now?: Date; ttlMs?: number }
): Promise<ZeroRetentionAttestation> {
  const approved = requireZeroRetentionModel(modelId)
  const now = options?.now ?? new Date()
  const ttl = options?.ttlMs ?? ZERO_RETENTION_ATTESTATION_TTL_MS
  const cached = cache.get(modelId)
  if (cached && now.getTime() - cached.checkedAt.getTime() < ttl) return cached

  const fetchImpl = options?.fetchImpl ?? (fetch as unknown as FetchLike)
  let provider: string | null = null
  try {
    const response = await fetchImpl(approved.evidenceUrl, {
      signal: AbortSignal.timeout(ATTESTATION_TIMEOUT_MS),
    })
    if (response.ok) provider = qualifyingProvider(await response.json())
  } catch {
    provider = null
  }
  if (!provider) throw new AiModelZeroRetentionRequiredError(modelId)

  const attestation = { modelId, provider, checkedAt: now }
  cache.set(modelId, attestation)
  return attestation
}
