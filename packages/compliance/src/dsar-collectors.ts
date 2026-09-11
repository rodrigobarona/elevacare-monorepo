/**
 * DSAR collector registry. Phase 5 registers profile, bookings,
 * payments, consents, and notification preferences. Later phases
 * register their own collectors in their own PR.
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

export function hasDsarCollector(id: string): boolean {
  return collectors.has(id)
}

export function listDsarCollectors(): readonly DsarCollector[] {
  return [...collectors.values()]
}

export function resetDsarCollectorsForTests(): void {
  collectors.clear()
}
