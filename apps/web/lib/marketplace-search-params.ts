import type { ListExpertsFilters, SessionMode } from "@eleva/db"

import {
  COUNTRY_CODES as COUNTRY_CODE_LIST,
  LANGUAGE_CODES as LANGUAGE_CODE_LIST,
  SESSION_MODES,
} from "@/lib/marketplace-constants"

const LANGUAGE_CODES = new Set<string>(LANGUAGE_CODE_LIST)
const COUNTRY_CODES = new Set<string>(COUNTRY_CODE_LIST)

export interface MarketplaceParams {
  category?: string
  language?: string
  country?: string
  sessionMode?: SessionMode
  search?: string
  page?: number
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isSessionMode(value: string | undefined): value is SessionMode {
  return (
    value !== undefined && (SESSION_MODES as readonly string[]).includes(value)
  )
}

/**
 * Coerces Next.js search params into the strict marketplace shape.
 * Drops anything we don't recognise — defensive against URL tampering.
 */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>
): MarketplaceParams {
  const out: MarketplaceParams = {}

  const category = pickFirst(raw.category)?.trim().toLowerCase()
  if (category && /^[a-z0-9-]{2,64}$/.test(category)) {
    out.category = category
  }

  const language = pickFirst(raw.language)?.trim().toLowerCase()
  if (language && LANGUAGE_CODES.has(language)) {
    out.language = language
  }

  const country = pickFirst(raw.country)?.trim().toUpperCase()
  if (country && COUNTRY_CODES.has(country)) {
    out.country = country
  }

  const session = pickFirst(raw.session)
  if (isSessionMode(session)) {
    out.sessionMode = session
  }

  const q = pickFirst(raw.q)?.trim()
  if (q && q.length >= 2 && q.length <= 80) {
    out.search = q
  }

  const page = pickFirst(raw.page)
  if (page) {
    const n = Number.parseInt(page, 10)
    if (Number.isFinite(n) && n > 0) out.page = n
  }

  return out
}

export function buildExpertFilters(
  params: MarketplaceParams,
  overrides?: Partial<ListExpertsFilters>
): ListExpertsFilters {
  return {
    categorySlug: params.category,
    languages: params.language ? [params.language] : undefined,
    countries: params.country ? [params.country] : undefined,
    sessionModes: params.sessionMode ? [params.sessionMode] : undefined,
    search: params.search,
    page: params.page,
    ...overrides,
  }
}
