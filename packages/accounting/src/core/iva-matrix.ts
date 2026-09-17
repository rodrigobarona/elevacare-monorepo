/**
 * Conservative IVA classifier for Eleva → expert platform fees (07.1).
 *
 * Provider-neutral: no TOConline imports. Lookups live in the TOConline
 * adapter. Does not POST sales documents, Comunicar série, invent OSS
 * thresholds, auto-classify EU-without-VIES as consumer, or treat extra-EU
 * as indiscriminate zero-rate.
 */

export const VIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** EU-27 ISO 3166-1 alpha-2 (2026). PT is territorial, not reverse-charge. */
export const EU_MEMBER_ISO_ALPHA2 = Object.freeze([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const)

const EU_MEMBER_SET: ReadonlySet<string> = new Set(EU_MEMBER_ISO_ALPHA2)

export type ExpertTerritory = "pt" | "eu" | "extra_eu"

export type IvaRegime =
  | "pending"
  | "pt_territorial"
  | "eu_reverse_charge"
  | "eu_unclassified"
  | "extra_eu_unclassified"
  | "vies_unavailable"

export type ViesStatus =
  | "not_applicable"
  | "valid"
  | "invalid"
  | "unavailable"
  | "missing_vat"

export type IvaDecision = {
  territory: ExpertTerritory
  taxCountryRegion: string
  regime: IvaRegime
  viesStatus: ViesStatus
  canIssue: boolean
  queueReason: string | null
}

export type ClassifyIvaInput = {
  /** Expert establishment country. `PT-AC` / `PT-MA` count as PT territorial. */
  countryIso: string
  vatNumber?: string | null
  viesStatus?: ViesStatus
  reverseChargeLegalReqsMet?: boolean
}

export type ViesLookupResult =
  | { status: "valid" }
  | { status: "invalid" }
  | { status: "unavailable" }

export type ViesLookup = {
  check(vatNumber: string): Promise<ViesLookupResult>
}

export function normalizeCountryIso(countryIso: string): string {
  return countryIso.trim().toUpperCase()
}

export function territoryFromCountry(countryIso: string): ExpertTerritory {
  const iso = normalizeCountryIso(countryIso)
  if (iso === "PT" || iso === "PT-AC" || iso === "PT-MA") return "pt"
  if (iso === "EL") return "eu"
  if (EU_MEMBER_SET.has(iso)) return "eu"
  return "extra_eu"
}

export function taxCountryRegionFromCountry(countryIso: string): string {
  const iso = normalizeCountryIso(countryIso)
  if (iso === "PT-AC" || iso === "PT-MA") return iso
  if (iso === "PT") return "PT"
  return iso
}

export function classifyIvaRegime(input: ClassifyIvaInput): IvaDecision {
  const territory = territoryFromCountry(input.countryIso)
  const taxCountryRegion = taxCountryRegionFromCountry(input.countryIso)
  if (territory === "pt") {
    return {
      territory,
      taxCountryRegion,
      regime: "pt_territorial",
      viesStatus: "not_applicable",
      canIssue: true,
      queueReason: null,
    }
  }

  if (territory === "extra_eu") {
    return {
      territory,
      taxCountryRegion,
      regime: "extra_eu_unclassified",
      viesStatus: "not_applicable",
      canIssue: false,
      queueReason: "extra_eu_not_indiscriminate_zero_rate",
    }
  }

  const vatNumber = input.vatNumber?.trim() ?? ""
  const viesStatus = input.viesStatus ?? "missing_vat"
  if (viesStatus === "unavailable") {
    return {
      territory,
      taxCountryRegion,
      regime: "vies_unavailable",
      viesStatus,
      canIssue: false,
      queueReason: "vies_unavailable_fail_closed",
    }
  }

  if (viesStatus !== "valid" || vatNumber.length === 0) {
    return {
      territory,
      taxCountryRegion,
      regime: "eu_unclassified",
      viesStatus: vatNumber.length === 0 ? "missing_vat" : viesStatus,
      canIssue: false,
      queueReason: "eu_without_valid_vies_not_auto_consumer",
    }
  }

  if (!input.reverseChargeLegalReqsMet) {
    return {
      territory,
      taxCountryRegion,
      regime: "eu_unclassified",
      viesStatus,
      canIssue: false,
      queueReason: "eu_reverse_charge_legal_reqs_unmet",
    }
  }

  return {
    territory,
    taxCountryRegion,
    regime: "eu_reverse_charge",
    viesStatus,
    canIssue: true,
    queueReason: null,
  }
}

export function createViesCache(
  lookup: ViesLookup,
  options: { ttlMs?: number; now?: () => number } = {}
): ViesLookup {
  const ttlMs = options.ttlMs ?? VIES_CACHE_TTL_MS
  const now = options.now ?? Date.now
  const cache = new Map<
    string,
    { result: ViesLookupResult; expiresAt: number }
  >()

  return {
    async check(vatNumber: string): Promise<ViesLookupResult> {
      const key = vatNumber.trim().toUpperCase()
      const cached = cache.get(key)
      if (cached && cached.expiresAt > now()) {
        return cached.result
      }
      let result: ViesLookupResult
      try {
        result = await lookup.check(key)
      } catch {
        result = { status: "unavailable" }
      }
      if (result.status !== "unavailable") {
        cache.set(key, { result, expiresAt: now() + ttlMs })
      }
      return result
    },
  }
}
