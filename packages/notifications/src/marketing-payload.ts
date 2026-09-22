import { z } from "zod"

/** Closed product tiers — never free-form strings into Resend. */
export const MARKETING_PLAN_TIERS = [
  "member_free",
  "expert_community",
  "expert_top",
  "clinic_starter",
  "clinic_growth",
] as const

export type MarketingPlanTier = (typeof MARKETING_PLAN_TIERS)[number]

/**
 * Caller-supplied Lane 2 fields (optional). `first_name` / `locale` are
 * never accepted from callers — they are derived from the Neon user row
 * inside `triggerAutomation` so PHI cannot be smuggled in.
 */
export const MarketingCallerPayloadSchema = z
  .object({
    plan_tier: z.enum(MARKETING_PLAN_TIERS).optional(),
    generic_booking_count: z
      .number()
      .int()
      .nonnegative()
      .max(100_000)
      .optional(),
  })
  .strict()

export type MarketingCallerPayload = z.infer<
  typeof MarketingCallerPayloadSchema
>

/**
 * PHI-free payload sent to Resend. `.strict()` rejects unknown keys.
 */
export const MarketingPayloadSchema = MarketingCallerPayloadSchema.extend({
  first_name: z.string().trim().min(1).max(100),
  locale: z.enum(["en", "pt", "es"]),
}).strict()

export type MarketingPayload = z.infer<typeof MarketingPayloadSchema>

/** Seeded Resend Automation event names (dashboard-managed). */
export const MARKETING_AUTOMATION_EVENTS = [
  "welcome.expert",
  "welcome.patient",
  "partner.approved",
  "pack.expiring",
  "reengagement.90d",
  "abandoned_checkout",
] as const

export type MarketingAutomationEvent =
  (typeof MARKETING_AUTOMATION_EVENTS)[number]

export const MarketingAutomationEventSchema = z.enum(
  MARKETING_AUTOMATION_EVENTS
)
