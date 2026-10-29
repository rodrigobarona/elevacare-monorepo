import { Redis } from "@upstash/redis"

/** Better Auth secondaryStorage expects strings; Upstash may auto-parse JSON. */
export function asStorageString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/** The slice of the Upstash client `incrementWithTtl` uses (keeps tests mockable). */
export type IncrementPipelineClient = {
  pipeline(): {
    incr(key: string): unknown
    expire(key: string, seconds: number, option: "NX"): unknown
    exec(): Promise<unknown[]>
  }
}

/**
 * Atomically INCR + EXPIRE NX. Better Auth rate limiting requires
 * SecondaryStorage.increment(key, ttlSeconds) to set TTL only when the key is
 * created so the window resets; bare INCR leaves counters forever → permanent 429.
 */
export async function incrementWithTtl(
  redis: IncrementPipelineClient,
  key: string,
  ttl: number
): Promise<number> {
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new TypeError("Redis increment TTL must be a positive integer")
  }
  const pipeline = redis.pipeline()
  pipeline.incr(key)
  pipeline.expire(key, ttl, "NX")
  const results = await pipeline.exec()
  const count = results[0]
  if (typeof count !== "number") {
    throw new TypeError("Redis INCR returned a non-number")
  }
  return count
}

export type AuthSecondaryStorage = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  getAndDelete: (key: string) => Promise<string | null>
  increment: (key: string, ttl: number) => Promise<number>
}

export function createSecondaryStorage(
  env: NodeJS.ProcessEnv = process.env
): AuthSecondaryStorage | undefined {
  const url = env.KV_REST_API_URL
  const token = env.KV_REST_API_TOKEN
  if (!url || !token) return undefined

  const redis = new Redis({ url, token })
  return {
    get: async (key: string) => asStorageString(await redis.get(key)),
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await redis.set(key, value, { ex: ttl })
        return
      }
      await redis.set(key, value)
    },
    delete: async (key: string) => {
      await redis.del(key)
    },
    getAndDelete: async (key: string) =>
      asStorageString(await redis.getdel(key)),
    increment: (key: string, ttl: number) => incrementWithTtl(redis, key, ttl),
  }
}

/** Headers Better Auth should trust for client IP on Vercel (single-value first). */
export const AUTH_IP_ADDRESS_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
  "x-forwarded-for",
] as const
