import { describe, expect, it } from "vitest"
import {
  InboxNotificationIdSchema,
  ListInboxQuerySchema,
} from "@eleva/api-client"

describe("ListInboxQuerySchema", () => {
  it("treats unread=true as unreadOnly", () => {
    expect(ListInboxQuerySchema.parse({ unread: "true" }).unread).toBe(true)
    expect(ListInboxQuerySchema.parse({ unread: "1" }).unread).toBe(true)
  })

  it("treats missing or false unread as list-all", () => {
    expect(ListInboxQuerySchema.parse({}).unread).toBe(false)
    expect(ListInboxQuerySchema.parse({ unread: "false" }).unread).toBe(false)
  })

  it("clamps limit to 1..100", () => {
    expect(ListInboxQuerySchema.parse({ limit: "20" }).limit).toBe(20)
    expect(() => ListInboxQuerySchema.parse({ limit: "0" })).toThrow()
    expect(() => ListInboxQuerySchema.parse({ limit: "101" })).toThrow()
  })
})

describe("InboxNotificationIdSchema", () => {
  it("accepts a UUID and rejects other path segments", () => {
    expect(
      InboxNotificationIdSchema.parse("11111111-1111-4111-8111-111111111111")
    ).toBe("11111111-1111-4111-8111-111111111111")
    expect(() => InboxNotificationIdSchema.parse("not-a-uuid")).toThrow()
  })
})
