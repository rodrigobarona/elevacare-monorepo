import { and, eq, inArray, sql } from "drizzle-orm"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"

export const DOMAIN_EVENT_TYPES = ["booking.guest_activation_required"] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

export type GuestActivationPayload = {
  bookingId: string
  reservationId: string
}

export type DomainEvent = {
  type: "booking.guest_activation_required"
  orgId: string
  idempotencyKey: string
  payload: GuestActivationPayload
}

export const DEFAULT_SUBSCRIBERS: Record<DomainEventType, readonly string[]> = {
  "booking.guest_activation_required": ["guest-activation"],
}

export type DomainEventSubscriber = (event: {
  id: string
  type: DomainEventType
  orgId: string
  payload: Record<string, unknown>
}) => Promise<void>

const MAX_ATTEMPTS = 10
const STALE_PROCESSING_MS = 10 * 60 * 1000

export async function emitDomainEvent(
  tx: Tx,
  event: DomainEvent,
  subscribers: readonly string[] = DEFAULT_SUBSCRIBERS[event.type]
): Promise<{ eventId: string; created: boolean }> {
  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: event.orgId,
      type: event.type,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey,
    })
    .onConflictDoNothing({
      target: main.domainEventsOutbox.idempotencyKey,
    })
    .returning({ id: main.domainEventsOutbox.id })

  let eventId = inserted[0]?.id
  const created = Boolean(eventId)
  if (!eventId) {
    const [existing] = await tx
      .select({ id: main.domainEventsOutbox.id })
      .from(main.domainEventsOutbox)
      .where(eq(main.domainEventsOutbox.idempotencyKey, event.idempotencyKey))
      .limit(1)
    if (!existing) {
      throw new Error("emitDomainEvent: conflict without existing row")
    }
    eventId = existing.id
  }

  for (const subscriberId of subscribers) {
    await tx
      .insert(main.domainEventDeliveries)
      .values({
        orgId: event.orgId,
        eventId,
        subscriberId,
        status: "pending",
      })
      .onConflictDoNothing()
  }

  return { eventId, created }
}

export type PublishDomainEventsResult = {
  claimed: number
  succeeded: number
  failed: number
  dead: number
}

type ClaimedDelivery = {
  id: string
  eventId: string
  subscriberId: string
  attempts: number
  orgId: string
  type: string
  payload: Record<string, unknown>
}

export async function publishPendingDomainEvents(input: {
  subscribers: Record<string, DomainEventSubscriber>
  batchSize?: number
  maxAttempts?: number
}): Promise<PublishDomainEventsResult> {
  const batchSize = input.batchSize ?? 25
  const maxAttempts = input.maxAttempts ?? MAX_ATTEMPTS
  const subscribers = input.subscribers

  const deliveries = await claimPendingDeliveries(batchSize, maxAttempts)
  const result: PublishDomainEventsResult = {
    claimed: deliveries.length,
    succeeded: 0,
    failed: 0,
    dead: 0,
  }
  if (deliveries.length === 0) return result

  const touchedEventIds = new Set<string>()
  for (const delivery of deliveries) {
    touchedEventIds.add(delivery.eventId)
    const run = subscribers[delivery.subscriberId]
    try {
      if (!run) {
        throw new Error(`unknown subscriber: ${delivery.subscriberId}`)
      }
      await run({
        id: delivery.eventId,
        type: delivery.type as DomainEventType,
        orgId: delivery.orgId,
        payload: delivery.payload,
      })
      await markDeliverySucceeded(delivery.id)
      result.succeeded += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const dead = delivery.attempts >= maxAttempts
      await markDeliveryFailed(delivery.id, message, dead)
      if (dead) result.dead += 1
      else result.failed += 1
    }
  }

  for (const eventId of touchedEventIds) {
    await markEventPublishedIfComplete(eventId)
  }

  return result
}

async function claimPendingDeliveries(
  batchSize: number,
  maxAttempts: number
): Promise<ClaimedDelivery[]> {
  return withPlatformAdminContext(async (tx) => {
    const claimed = await tx.execute(sql<{ id: string }>`
      UPDATE domain_event_deliveries AS d
      SET
        status = 'processing',
        claimed_at = now(),
        attempts = d.attempts + 1
      WHERE d.id IN (
        SELECT c.id
        FROM domain_event_deliveries AS c
        WHERE (
          c.status = 'pending'
          OR (
            c.status = 'failed'
            AND c.claimed_at < now() - make_interval(secs => least(c.attempts * 60, 3600))
          )
          OR (
            c.status = 'processing'
            AND c.claimed_at < now() - make_interval(secs => ${STALE_PROCESSING_MS / 1000})
          )
        )
          AND c.attempts < ${maxAttempts}
        ORDER BY c.id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING d.id
    `)

    const claimedIds = executeRowIds(claimed)
    if (claimedIds.length === 0) return []

    return tx
      .select({
        id: main.domainEventDeliveries.id,
        eventId: main.domainEventDeliveries.eventId,
        subscriberId: main.domainEventDeliveries.subscriberId,
        attempts: main.domainEventDeliveries.attempts,
        orgId: main.domainEventDeliveries.orgId,
        type: main.domainEventsOutbox.type,
        payload: main.domainEventsOutbox.payload,
      })
      .from(main.domainEventDeliveries)
      .innerJoin(
        main.domainEventsOutbox,
        eq(main.domainEventsOutbox.id, main.domainEventDeliveries.eventId)
      )
      .where(inArray(main.domainEventDeliveries.id, claimedIds))
  })
}

async function markDeliverySucceeded(deliveryId: string) {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.domainEventDeliveries)
      .set({
        status: "succeeded",
        completedAt: new Date(),
        lastError: null,
      })
      .where(eq(main.domainEventDeliveries.id, deliveryId))
  })
}

async function markDeliveryFailed(
  deliveryId: string,
  message: string,
  dead: boolean
) {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.domainEventDeliveries)
      .set({
        status: dead ? "dead" : "failed",
        lastError: message.slice(0, 2000),
        completedAt: dead ? new Date() : null,
      })
      .where(eq(main.domainEventDeliveries.id, deliveryId))
  })
}

async function markEventPublishedIfComplete(eventId: string) {
  await withPlatformAdminContext(async (tx) => {
    const [open] = await tx
      .select({ id: main.domainEventDeliveries.id })
      .from(main.domainEventDeliveries)
      .where(
        and(
          eq(main.domainEventDeliveries.eventId, eventId),
          inArray(main.domainEventDeliveries.status, [
            "pending",
            "processing",
            "failed",
          ])
        )
      )
      .limit(1)
    if (!open) {
      await tx
        .update(main.domainEventsOutbox)
        .set({ publishedAt: new Date() })
        .where(eq(main.domainEventsOutbox.id, eventId))
    }
  })
}

function executeRowIds(result: unknown): string[] {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === "object" && "rows" in result
      ? (result as { rows: unknown }).rows
      : []
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (row && typeof row === "object" && "id" in row) {
      const id = (row as { id: unknown }).id
      return typeof id === "string" ? [id] : []
    }
    return []
  })
}
