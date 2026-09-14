/**
 * Throwaway 07.0 guard. Live Eleva series (ELEVA, ELEVA-FEE-*, ELEVA-SAAS-*)
 * must never receive spike invoices. Delete this directory before PR 07.1.
 *
 * The founder-created series prefix is exact `TEST`. Hyphenated `TEST-…`
 * prefixes remain allowed for a later dedicated fee series.
 */
export function normalizeTestSeriesPrefix(prefix: string): string {
  return prefix.trim()
}

export function isAllowedTestSeriesPrefix(prefix: string): boolean {
  const normalized = normalizeTestSeriesPrefix(prefix)
  return normalized === "TEST" || normalized.startsWith("TEST-")
}

export function assertTestSeriesPrefix(
  prefix: string | undefined
): asserts prefix is string {
  if (!prefix || !isAllowedTestSeriesPrefix(prefix)) {
    throw new Error(
      "TOCONLINE_SERIES_PREFIX must be TEST or start with TEST- for the 07.0 spike. Refusing to call TOConline against a live series."
    )
  }
}
