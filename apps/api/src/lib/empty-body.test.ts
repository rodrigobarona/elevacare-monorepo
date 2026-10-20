import { describe, expect, it } from "vitest"
import { rejectUnexpectedBody } from "./empty-body"

function post(body?: string) {
  return new Request("https://api.test/x", { method: "POST", body })
}

describe("rejectUnexpectedBody", () => {
  it("accepts an absent, blank or empty-object body", async () => {
    expect(await rejectUnexpectedBody(post(), {})).toBeNull()
    expect(await rejectUnexpectedBody(post("  "), {})).toBeNull()
    expect(await rejectUnexpectedBody(post("{}"), {})).toBeNull()
  })

  it("rejects unknown fields with 422", async () => {
    const res = await rejectUnexpectedBody(post('{"force":true}'), {})
    expect(res?.status).toBe(422)
    expect(await res?.json()).toMatchObject({ error: "validation" })
  })

  it("rejects malformed JSON and non-object bodies", async () => {
    expect((await rejectUnexpectedBody(post("{"), {}))?.status).toBe(422)
    expect((await rejectUnexpectedBody(post("[]"), {}))?.status).toBe(422)
  })
})
