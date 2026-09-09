export const ROUTE_AUTH_MODE = [
  "public",
  "session",
  "signature",
  "internal",
] as const

export type RouteAuthMode = (typeof ROUTE_AUTH_MODE)[number]

export type RoutePolicy = {
  auth: RouteAuthMode
  rateLimit: boolean
  botId: boolean
}
