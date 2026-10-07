import { describe, expect, it, vi } from "vitest"
import { buildSessionRoomBody } from "./room-options"
import { createDailyClient, dailyClientFromEnv } from "./rooms"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"

describe("createDailyClient", () => {
  it("GET-or-creates a named room and rewrites the product URL", async () => {
    const input = {
      bookingId: BOOKING_ID,
      startAt: new Date("2026-10-07T10:00:00.000Z"),
      endAt: new Date("2026-10-07T11:00:00.000Z"),
    }
    const expected = buildSessionRoomBody(input)
    const fetchImpl = vi.fn(
      async (inputUrl: RequestInfo | URL, init?: RequestInit) => {
        const url = String(inputUrl)
        if (url.endsWith("/rooms") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              name: `eleva-${BOOKING_ID}`,
              url: "https://wrong.daily.co/eleva-x",
              privacy: "private",
              config: expected.properties,
            }),
            { status: 200 }
          )
        }
        throw new Error(`unexpected ${url}`)
      }
    )

    const client = createDailyClient({
      apiKey: "key",
      domain: "eleva.daily.co",
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const room = await client.createSessionRoom(input)

    expect(room.name).toBe(`eleva-${BOOKING_ID}`)
    expect(room.url).toBe(`https://eleva.daily.co/eleva-${BOOKING_ID}`)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("adopts an existing room on 409 when the contract matches", async () => {
    const input = {
      bookingId: BOOKING_ID,
      startAt: new Date("2026-10-07T10:00:00.000Z"),
      endAt: new Date("2026-10-07T11:00:00.000Z"),
    }
    const expected = buildSessionRoomBody(input)
    const fetchImpl = vi.fn(
      async (inputUrl: RequestInfo | URL, init?: RequestInit) => {
        const url = String(inputUrl)
        if (url.endsWith("/rooms") && init?.method === "POST") {
          return new Response("exists", { status: 409 })
        }
        if (url.includes(`/rooms/eleva-${BOOKING_ID}`)) {
          return new Response(
            JSON.stringify({
              name: `eleva-${BOOKING_ID}`,
              url: "https://eleva.daily.co/eleva-old",
              privacy: "private",
              config: expected.properties,
            }),
            { status: 200 }
          )
        }
        throw new Error(`unexpected ${url}`)
      }
    )

    const client = createDailyClient({
      apiKey: "key",
      domain: "eleva",
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const room = await client.createSessionRoom(input)

    expect(room.url).toBe(`https://eleva.daily.co/eleva-${BOOKING_ID}`)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("repairs a leftover 409 room that does not match the contract", async () => {
    const input = {
      bookingId: BOOKING_ID,
      startAt: new Date("2026-10-07T10:00:00.000Z"),
      endAt: new Date("2026-10-07T11:00:00.000Z"),
    }
    const fetchImpl = vi.fn(
      async (inputUrl: RequestInfo | URL, init?: RequestInit) => {
        const url = String(inputUrl)
        if (url.endsWith("/rooms") && init?.method === "POST") {
          return new Response("exists", { status: 409 })
        }
        if (
          url.includes(`/rooms/eleva-${BOOKING_ID}`) &&
          init?.method !== "POST"
        ) {
          return new Response(
            JSON.stringify({
              name: `eleva-${BOOKING_ID}`,
              url: "https://eleva.daily.co/eleva-old",
              privacy: "public",
              config: { enable_recording: "cloud" },
            }),
            { status: 200 }
          )
        }
        if (
          url.includes(`/rooms/eleva-${BOOKING_ID}`) &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(String(init.body)) as {
            privacy?: string
            properties: ReturnType<typeof buildSessionRoomBody>["properties"]
          }
          expect(body.privacy).toBe("private")
          return new Response(
            JSON.stringify({
              name: `eleva-${BOOKING_ID}`,
              url: "https://eleva.daily.co/eleva-old",
              privacy: "private",
              config: body.properties,
            }),
            { status: 200 }
          )
        }
        throw new Error(`unexpected ${url}`)
      }
    )

    const client = createDailyClient({
      apiKey: "key",
      domain: "eleva",
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const room = await client.createSessionRoom(input)
    expect(room.url).toBe(`https://eleva.daily.co/eleva-${BOOKING_ID}`)
    expect(
      fetchImpl.mock.calls.some(
        ([url, init]) =>
          String(url).includes(`/rooms/eleva-${BOOKING_ID}`) &&
          init?.method === "POST"
      )
    ).toBe(true)
  })

  it("builds from env when keys are present", async () => {
    const prevKey = process.env.DAILY_API_KEY
    const prevDomain = process.env.DAILY_DOMAIN
    process.env.DAILY_API_KEY = "key"
    process.env.DAILY_DOMAIN = "eleva"
    try {
      const client = dailyClientFromEnv(
        vi.fn(
          async () => new Response("{}", { status: 404 })
        ) as unknown as typeof fetch
      )
      await expect(client.getRoom("missing")).resolves.toBeNull()
    } finally {
      if (prevKey === undefined) delete process.env.DAILY_API_KEY
      else process.env.DAILY_API_KEY = prevKey
      if (prevDomain === undefined) delete process.env.DAILY_DOMAIN
      else process.env.DAILY_DOMAIN = prevDomain
    }
  })

  it("rejects a created room that does not match the session contract", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith("/rooms") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              name: `eleva-${BOOKING_ID}`,
              url: "https://eleva.daily.co/eleva-x",
              privacy: "private",
              config: { enable_recording: "cloud" },
            }),
            { status: 200 }
          )
        }
        throw new Error(`unexpected ${url}`)
      }
    )

    const client = createDailyClient({
      apiKey: "key",
      domain: "eleva.daily.co",
      fetch: fetchImpl as unknown as typeof fetch,
    })

    await expect(
      client.createSessionRoom({
        bookingId: BOOKING_ID,
        startAt: new Date("2026-10-07T10:00:00.000Z"),
        endAt: new Date("2026-10-07T11:00:00.000Z"),
      })
    ).rejects.toThrow(/session contract/)
  })

  it("reads domain id from GET / when env is empty", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ domain_id: "dom_1" }), {
        status: 200,
      })
    })

    const client = createDailyClient({
      apiKey: "key",
      domain: "eleva",
      fetch: fetchImpl as unknown as typeof fetch,
    })

    await expect(client.getDomainId()).resolves.toBe("dom_1")
  })
})
