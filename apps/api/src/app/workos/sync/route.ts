import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { Redis } from "@upstash/redis"
import { getWorkOS } from "@eleva/auth/server"
import {
  syncUser,
  softDeleteUser,
  syncOrganization,
  softDeleteOrganization,
  syncMembership,
  deleteMembership,
} from "@eleva/auth"
import type {
  WorkOSUserEventData,
  WorkOSOrganizationEventData,
  WorkOSMembershipEventData,
} from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const CURSOR_KEY = "workos:events:cursor"

const SYNC_EVENTS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "organization_membership.created",
  "organization_membership.updated",
  "organization_membership.deleted",
] as const

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

async function handler() {
  const redis = getRedis()
  const workos = getWorkOS()

  const cursor = await redis.get<string>(CURSOR_KEY)

  let totalProcessed = 0
  let lastEventId = cursor
  let hasMore = true

  while (hasMore) {
    const response = await workos.events.listEvents({
      events: [...SYNC_EVENTS],
      ...(lastEventId ? { after: lastEventId } : {}),
    })

    const events = response.data
    if (events.length === 0) {
      hasMore = false
      break
    }

    for (const event of events) {
      switch (event.event) {
        case "user.created":
        case "user.updated":
          await syncUser(event.data as unknown as WorkOSUserEventData)
          break
        case "user.deleted":
          await softDeleteUser(
            (event.data as unknown as WorkOSUserEventData).id
          )
          break
        case "organization.created":
        case "organization.updated":
          await syncOrganization(
            event.data as unknown as WorkOSOrganizationEventData
          )
          break
        case "organization.deleted":
          await softDeleteOrganization(
            (event.data as unknown as WorkOSOrganizationEventData).id
          )
          break
        case "organization_membership.created":
        case "organization_membership.updated":
          await syncMembership(
            event.data as unknown as WorkOSMembershipEventData
          )
          break
        case "organization_membership.deleted":
          await deleteMembership(
            event.data as unknown as WorkOSMembershipEventData
          )
          break
      }
    }

    lastEventId = events.at(-1)!.id
    totalProcessed += events.length

    hasMore = response.listMetadata?.after != null
  }

  if (lastEventId && lastEventId !== cursor) {
    await redis.set(CURSOR_KEY, lastEventId)
  }

  return Response.json({ processed: totalProcessed })
}

export const POST = verifySignatureAppRouter(handler)
