import { afterEach, describe, expect, it, vi } from "vitest"
import {
  bearerMatches,
  isAuthorizedWorkflowCall,
  verifyQstashSignature,
} from "./internal-auth"

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }))

vi.mock("@upstash/qstash", () => ({
  Receiver: class {
    verify = verify
  },
}))

afterEach(() => {
  vi.unstubAllEnvs()
  verify.mockReset()
})

function post(headers: Record<string, string>, body = "{}"): Request {
  return new Request("https://api.eleva.care/workflows/x", {
    method: "POST",
    headers,
    body,
  })
}

describe("bearerMatches", () => {
  it("accepts the exact bearer and rejects everything else", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true)
    expect(bearerMatches("Bearer s3cre", "s3cret")).toBe(false)
    expect(bearerMatches("Bearer s3cret-longer", "s3cret")).toBe(false)
    expect(bearerMatches("s3cret", "s3cret")).toBe(false)
    expect(bearerMatches(null, "s3cret")).toBe(false)
    expect(bearerMatches("Bearer ", "")).toBe(false)
    expect(bearerMatches("Bearer x", undefined)).toBe(false)
  })
})

describe("verifyQstashSignature", () => {
  it("returns false without signature or keys and never calls the receiver", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "cur")
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "")
    expect(
      await verifyQstashSignature(post({ "upstash-signature": "sig" }))
    ).toBe(false)
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next")
    expect(await verifyQstashSignature(post({}))).toBe(false)
    expect(verify).not.toHaveBeenCalled()
  })

  it("verifies against the body without consuming the request", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "cur")
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next")
    verify.mockResolvedValue(true)
    const request = post({ "upstash-signature": "sig" }, '{"a":1}')
    expect(await verifyQstashSignature(request)).toBe(true)
    expect(verify).toHaveBeenCalledWith({
      signature: "sig",
      body: '{"a":1}',
      url: "https://api.eleva.care/workflows/x",
    })
    expect(await request.json()).toEqual({ a: 1 })
  })

  it("treats a throwing receiver as invalid", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "cur")
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next")
    verify.mockRejectedValue(new Error("bad signature"))
    expect(
      await verifyQstashSignature(post({ "upstash-signature": "sig" }))
    ).toBe(false)
  })
})

describe("isAuthorizedWorkflowCall", () => {
  it("accepts the drain secret or a valid QStash signature", async () => {
    vi.stubEnv("WORKFLOWS_DRAIN_SECRET", "drain")
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "cur")
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next")
    expect(
      await isAuthorizedWorkflowCall(post({ authorization: "Bearer drain" }))
    ).toBe(true)
    verify.mockResolvedValue(true)
    expect(
      await isAuthorizedWorkflowCall(post({ "upstash-signature": "sig" }))
    ).toBe(true)
    verify.mockResolvedValue(false)
    expect(
      await isAuthorizedWorkflowCall(
        post({ authorization: "Bearer nope", "upstash-signature": "sig" })
      )
    ).toBe(false)
  })
})
