import { Redis } from "@upstash/redis"
import { env } from "@eleva/config/env"

let redis: Redis | null = null

/**
 * Slot-hold Redis client. Uses the Vercel Marketplace KV REST names.
 */
export function getBookingRedis(): Redis | null {
  if (redis) return redis
  const e = env()
  const url = e.KV_REST_API_URL
  const token = e.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}
