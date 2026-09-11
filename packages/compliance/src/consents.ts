import { createHmac } from "node:crypto"

export const CONSENT_KINDS = [
  "terms",
  "privacy",
  "health_data_processing",
  "marketing",
] as const

export type ConsentKind = (typeof CONSENT_KINDS)[number]

export const FUNNEL_CONSENT_KINDS = [
  "terms",
  "privacy",
  "health_data_processing",
] as const satisfies readonly ConsentKind[]

export type FunnelConsentKind = (typeof FUNNEL_CONSENT_KINDS)[number]

export const CONSENT_DOCUMENT_VERSION = "dev-2026-09-09"

const DRAFT_CONSENT_VERSION_PREFIX = "dev-"

export function isDraftConsentVersion(version: string): boolean {
  return version.startsWith(DRAFT_CONSENT_VERSION_PREFIX)
}

/**
 * Working pre-launch versions (prefix `dev-`) must not accept consent on
 * the production Vercel environment. Legal and the DPO replace this
 * value before go-live (D-10).
 */
type DeploymentEnv = {
  VERCEL_ENV?: string
}

function currentDeploymentEnv(): DeploymentEnv {
  return { VERCEL_ENV: process.env.VERCEL_ENV }
}

export function assertConsentVersionsApprovedForDeployment(
  env: DeploymentEnv = currentDeploymentEnv()
): void {
  if (env.VERCEL_ENV !== "production") {
    return
  }
  if (!isDraftConsentVersion(CONSENT_DOCUMENT_VERSION)) {
    return
  }
  throw new Error(
    "CONSENT_DOCUMENT_VERSION is a working pre-launch draft and cannot accept production consent. Replace it after legal and DPO sign-off."
  )
}

/** Public path slug for each funnel consent kind. */
export const CONSENT_DOCUMENT_SLUGS = {
  terms: "terms",
  privacy: "privacy",
  health_data_processing: "health-data",
} as const satisfies Record<FunnelConsentKind, string>

export type ConsentDocument = {
  version: string
  urls: Record<"en" | "pt" | "es", string>
}

function localeLegalUrl(locale: "en" | "pt" | "es", slug: string): string {
  const path = `/legal/${slug}`
  return locale === "en" ? path : `/${locale}${path}`
}

function documentFor(kind: FunnelConsentKind): ConsentDocument {
  const slug = CONSENT_DOCUMENT_SLUGS[kind]
  return {
    version: CONSENT_DOCUMENT_VERSION,
    urls: {
      en: localeLegalUrl("en", slug),
      pt: localeLegalUrl("pt", slug),
      es: localeLegalUrl("es", slug),
    },
  }
}

/**
 * Working pre-launch document versions (D-10). Recorded 2026-09-09 by
 * Rodrigo Barona as founder/product owner. Not DPO-approved. Re-sign
 * before go-live.
 */
export const CONSENT_DOCUMENTS: Record<FunnelConsentKind, ConsentDocument> = {
  terms: documentFor("terms"),
  privacy: documentFor("privacy"),
  health_data_processing: documentFor("health_data_processing"),
}

export function requiredConsentVersions(
  env: DeploymentEnv = currentDeploymentEnv()
): Record<FunnelConsentKind, string> {
  assertConsentVersionsApprovedForDeployment(env)
  const versions = {} as Record<FunnelConsentKind, string>
  for (const kind of FUNNEL_CONSENT_KINDS) {
    versions[kind] = CONSENT_DOCUMENTS[kind].version
  }
  return versions
}

export type FunnelConsentGrant = {
  kind: ConsentKind
  version: string
}

export type FunnelConsentCheck =
  | { ok: true }
  | { ok: false; error: "CONSENT_VERSION_OUTDATED" }

export function validateFunnelConsents(
  grants: readonly { kind: string; version: string }[],
  env: DeploymentEnv = currentDeploymentEnv()
): FunnelConsentCheck {
  const required = requiredConsentVersions(env)
  const byKind = new Map<string, string>()
  for (const grant of grants) {
    byKind.set(grant.kind, grant.version)
  }
  for (const kind of FUNNEL_CONSENT_KINDS) {
    if (byKind.get(kind) !== required[kind]) {
      return { ok: false, error: "CONSENT_VERSION_OUTDATED" }
    }
  }
  return { ok: true }
}

const CONSENT_HASH_KEY_MIN_LENGTH = 32

export function hashGuestEmail(
  email: string,
  secret: string | undefined = process.env.CONSENT_HASH_KEY
): string {
  if (!secret || secret.length < CONSENT_HASH_KEY_MIN_LENGTH) {
    throw new Error(
      "CONSENT_HASH_KEY is not configured with at least 32 characters"
    )
  }
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex")
}
