import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { Redis } from "@upstash/redis"
import { getWorkOS } from "@eleva/auth/server"
import {
  SYNC_EVENTS,
  processWorkOSEvent,
  type ExternalIdWriteBack,
} from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const CURSOR_KEY = "workos:events:cursor"

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
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

    const writeBacks: ExternalIdWriteBack[] = []

    for (const event of events) {
      const wb = await processWorkOSEvent(event)
      if (wb) writeBacks.push(wb)
    }

    await Promise.allSettled(
      writeBacks.map((wb) => {
        switch (wb.type) {
          case "user":
            return workos.userManagement.updateUser({
              userId: wb.workosId,
              externalId: wb.dbId,
            })
          case "organization":
            return workos.organizations.updateOrganization({
              organization: wb.workosId,
              externalId: wb.dbId,
            })
        }
      })
    )

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
