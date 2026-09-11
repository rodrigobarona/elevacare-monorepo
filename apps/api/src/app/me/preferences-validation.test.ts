import { describe, expect, it } from "vitest"
import {
  PutNotificationPreferencesRequestSchema,
  PatchMeRequestSchema,
  isIanaTimeZone,
} from "@eleva/api-client"

describe("isIanaTimeZone", () => {
  it("accepts Europe/Lisbon and rejects garbage", () => {
    expect(isIanaTimeZone("Europe/Lisbon")).toBe(true)
    expect(isIanaTimeZone("UTC")).toBe(true)
    expect(isIanaTimeZone("Not/AZone")).toBe(false)
    expect(isIanaTimeZone("+01:00")).toBe(false)
  })
})

describe("PutNotificationPreferencesRequestSchema", () => {
  const base = {
    preferences: [
      {
        channel: "email" as const,
        category: "booking" as const,
        enabled: true,
      },
    ],
  }

  it("accepts a valid matrix with matching quiet hours", () => {
    const parsed = PutNotificationPreferencesRequestSchema.safeParse({
      ...base,
      timezone: "Europe/Lisbon",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a lone quiet-hours bound", () => {
    const parsed = PutNotificationPreferencesRequestSchema.safeParse({
      ...base,
      quietHoursStart: "22:00",
    })
    expect(parsed.success).toBe(false)
  })

  it("rejects duplicate channel and category pairs", () => {
    const parsed = PutNotificationPreferencesRequestSchema.safeParse({
      preferences: [
        { channel: "email", category: "booking", enabled: true },
        { channel: "email", category: "booking", enabled: false },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it("accepts a preferences-only body without clearing timezone fields", () => {
    const parsed = PutNotificationPreferencesRequestSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.timezone).toBeUndefined()
    expect(parsed.data.quietHoursStart).toBeUndefined()
    expect(parsed.data.quietHoursEnd).toBeUndefined()
  })

  it("rejects an unknown timezone", () => {
    const parsed = PutNotificationPreferencesRequestSchema.safeParse({
      ...base,
      timezone: "Lisbon/Beach",
    })
    expect(parsed.success).toBe(false)
  })
})

describe("PatchMeRequestSchema", () => {
  it("requires at least one field", () => {
    expect(PatchMeRequestSchema.safeParse({}).success).toBe(false)
    expect(
      PatchMeRequestSchema.safeParse({ timezone: "Europe/Lisbon" }).success
    ).toBe(true)
  })
})
