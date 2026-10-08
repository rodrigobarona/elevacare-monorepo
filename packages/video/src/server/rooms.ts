import {
  buildSessionRoomBody,
  roomMatchesContract,
  roomUrlFor,
  type CreateSessionRoomInput,
  type SessionRoomCreateBody,
} from "./room-options"

const DAILY_API = "https://api.daily.co/v1"

export type DailyRoom = {
  name: string
  url: string
  privacy?: string
  config?: {
    nbf?: number
    exp?: number
    max_participants?: number
    enable_recording?: unknown
    enable_recording_ui?: boolean
    eject_at_room_exp?: boolean
    enforce_unique_user_ids?: boolean
  }
}

export type DailyClientOptions = {
  apiKey: string
  domain: string
  domainId?: string
  fetch?: typeof fetch
}

class DailyHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Daily HTTP ${status}`)
    this.name = "DailyHttpError"
  }
}

export function createDailyClient(options: DailyClientOptions) {
  const fetchImpl = options.fetch ?? fetch
  if (!options.apiKey) {
    throw new Error("DAILY_API_KEY is required")
  }

  async function dailyFetch(
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    return fetchImpl(`${DAILY_API}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
  }

  async function getDomainId(): Promise<string> {
    if (options.domainId) return options.domainId
    const res = await dailyFetch("/")
    if (!res.ok) {
      throw new DailyHttpError(res.status, await res.text())
    }
    const body = (await res.json()) as { domain_id?: string; id?: string }
    const id = body.domain_id ?? body.id
    if (!id) throw new Error("Daily domain id missing from GET /")
    return id
  }

  async function getRoom(name: string): Promise<DailyRoom | null> {
    const res = await dailyFetch(`/rooms/${encodeURIComponent(name)}`)
    if (res.status === 404) return null
    if (!res.ok) {
      throw new DailyHttpError(res.status, await res.text())
    }
    return (await res.json()) as DailyRoom
  }

  async function createSessionRoom(
    input: CreateSessionRoomInput
  ): Promise<DailyRoom> {
    const body = buildSessionRoomBody(input)
    const res = await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (res.status === 409) {
      const existing = await getRoom(body.name)
      if (existing) {
        if (roomMatchesContract(existing, body.properties)) {
          return withProductUrl(existing)
        }
        return updateSessionRoom(body.name, body.properties)
      }
      throw new DailyHttpError(409, await res.text())
    }
    if (!res.ok) {
      throw new DailyHttpError(res.status, await res.text())
    }
    const created = (await res.json()) as DailyRoom
    if (!roomMatchesContract(created, body.properties)) {
      throw new Error("Daily room does not match the session contract")
    }
    return withProductUrl(created)
  }

  async function updateSessionRoom(
    name: string,
    properties: SessionRoomCreateBody["properties"]
  ): Promise<DailyRoom> {
    const res = await dailyFetch(`/rooms/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ privacy: "private", properties }),
    })
    if (!res.ok) {
      throw new DailyHttpError(res.status, await res.text())
    }
    const updated = (await res.json()) as DailyRoom
    if (!roomMatchesContract(updated, properties)) {
      throw new Error(
        "Daily room could not be repaired to the session contract"
      )
    }
    return withProductUrl(updated)
  }

  async function deleteRoom(name: string): Promise<void> {
    const res = await dailyFetch(`/rooms/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
    if (res.status === 404 || res.ok) return
    throw new DailyHttpError(res.status, await res.text())
  }

  async function ejectParticipants(
    roomName: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length === 0) return
    const res = await dailyFetch(
      `/rooms/${encodeURIComponent(roomName)}/eject`,
      {
        method: "POST",
        body: JSON.stringify({ user_ids: userIds, ban: true }),
      }
    )
    if (res.status === 404 || res.ok) return
    throw new DailyHttpError(res.status, await res.text())
  }

  function withProductUrl(room: DailyRoom): DailyRoom {
    return {
      ...room,
      url: roomUrlFor(room.name, options.domain),
    }
  }

  return {
    getDomainId,
    getRoom,
    createSessionRoom,
    updateSessionRoom,
    deleteRoom,
    ejectParticipants,
    roomMatchesContract,
    DailyHttpError,
  }
}

export function dailyClientFromEnv(
  fetchImpl?: typeof fetch
): ReturnType<typeof createDailyClient> {
  const apiKey = process.env.DAILY_API_KEY
  const domain = process.env.DAILY_DOMAIN
  if (!apiKey || !domain) {
    throw new Error("DAILY_API_KEY and DAILY_DOMAIN are required")
  }
  return createDailyClient({
    apiKey,
    domain,
    domainId: process.env.DAILY_DOMAIN_ID || undefined,
    fetch: fetchImpl,
  })
}

export { DailyHttpError }
