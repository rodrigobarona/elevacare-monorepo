/**
 * DSAR collector registry skeleton (Phase 05.1).
 *
 * Phase 5.3 registers profile, bookings, payments, consents, and
 * notification-preference collectors. Later phases register their own
 * collectors in their own PR. This module only holds the registry —
 * it is not wired to a route or `dsarExport` job yet.
 */

export type DsarCollectorResult = {
  filename: string
  json: unknown
  csv?: string
}

export type DsarCollector = {
  id: string
  collect: (userId: string) => Promise<DsarCollectorResult>
}

const collectors = new Map<string, DsarCollector>()

export function registerDsarCollector(collector: DsarCollector): void {
  if (collectors.has(collector.id)) {
    throw new Error(`DSAR collector already registered: ${collector.id}`)
  }
  collectors.set(collector.id, collector)
}

export function listDsarCollectors(): readonly DsarCollector[] {
  return [...collectors.values()]
}

export function resetDsarCollectorsForTests(): void {
  collectors.clear()
}
