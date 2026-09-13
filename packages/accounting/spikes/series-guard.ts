/**
 * Throwaway 07.0 guard. Live Eleva series (ELEVA-FEE-*, ELEVA-SAAS-*) must
 * never receive spike invoices. Delete this directory before PR 07.1.
 */
export const TEST_SERIES_PREFIX = "TEST-"

export function assertTestSeriesPrefix(
  prefix: string | undefined
): asserts prefix is string {
  if (!prefix || !prefix.startsWith(TEST_SERIES_PREFIX)) {
    throw new Error(
      "TOCONLINE_SERIES_PREFIX must start with TEST- for the 07.0 spike. Refusing to call TOConline against a live series."
    )
  }
}
