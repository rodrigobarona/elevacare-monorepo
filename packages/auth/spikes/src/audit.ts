export type SpikeAuditEvent = {
  entity: "organization"
  action: "created"
  entityId: string
  payload: Record<string, string>
}

const events: SpikeAuditEvent[] = []

export function emitSpikeAudit(event: SpikeAuditEvent): void {
  events.push(event)
}

export function spikeAuditEvents(): readonly SpikeAuditEvent[] {
  return events
}
