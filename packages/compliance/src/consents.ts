export const CONSENT_KINDS = [
  "terms",
  "privacy",
  "health_data_processing",
] as const

export type ConsentKind = (typeof CONSENT_KINDS)[number]

/**
 * Legal-approved document version ids are a Phase 4 PR 04.2 D-gate
 * (D-10 / DPO). Do not invent placeholders here.
 */
export const CONSENT_DOCUMENTS: Partial<
  Record<ConsentKind, { version: string; urls: Record<string, string> }>
> = {}
