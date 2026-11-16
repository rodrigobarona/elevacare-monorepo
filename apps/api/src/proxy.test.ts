import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@eleva/config/env", () => ({
  resolveGatewayUrl: () => "https://eleva.care",
}))

const { default: proxy } = await import("./proxy")

async function get(path: string): Promise<Response> {
  return await proxy(new NextRequest(`https://api.eleva.care${path}`))
}

describe("api proxy", () => {
  it("bounces gateway-only pages that land on the API host", async () => {
    for (const path of [
      "/space/sessions?x=1",
      "/team/clinic-lisboa",
      "/academy/eleva",
      "/join/abc?g=t",
    ]) {
      const res = await get(path)
      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toBe(`https://eleva.care${path}`)
    }
  })

  it("keeps the API's own /expert routes", async () => {
    const res = await get("/expert/calendar")
    expect(res.headers.get("location")).toBeNull()
  })
})
