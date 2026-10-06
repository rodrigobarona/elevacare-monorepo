import { NOTIFICATION_KINDS, type NotificationKind } from "./kinds"
import { SendNotificationError } from "./errors"
import { isWithinQuietHours, quietHoursFrom } from "./quiet-hours"

export const NOTIFICATION_CHANNELS = ["email", "sms", "in_app"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const REQUIRED_NOTIFICATION_CATEGORIES = ["payment", "system"] as const

/** Spec fan-out order: in-app, then email, then SMS. */
export const CHANNEL_SEND_ORDER = ["in_app", "email", "sms"] as const

export type PreferenceRow = {
  channel: NotificationChannel
  category: "booking" | "reminder" | "payment" | "marketing" | "system"
  enabled: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  timezone?: string | null
}

/**
 * Quiet hours silence SMS only (email and in-app stay passive). Urgent
 * kinds such as the 1 h reminder and payment failures bypass them.
 */
export function quietHoursSilence(input: {
  kind: NotificationKind
  channel: NotificationChannel
  preferences: PreferenceRow[]
  now: Date
}): boolean {
  if (input.channel !== "sms") return false
  if (NOTIFICATION_KINDS[input.kind].urgency === "urgent") return false
  const quiet = quietHoursFrom(input.preferences)
  return quiet !== null && isWithinQuietHours(quiet, input.now)
}

export function supportedSendChannels(
  kind: NotificationKind,
  channelsOverride: NotificationChannel[] | undefined
): NotificationChannel[] {
  const allowed = NOTIFICATION_KINDS[kind].channels
  if (channelsOverride) {
    for (const channel of channelsOverride) {
      if (!(allowed as readonly string[]).includes(channel)) {
        throw new SendNotificationError(
          "CHANNEL_OVERRIDE_INVALID",
          `channelsOverride may only narrow ${kind} channels`
        )
      }
    }
  }
  const selected = channelsOverride ?? [...allowed]
  if (channelsOverride && selected.length === 0) {
    throw new SendNotificationError(
      "CHANNEL_OVERRIDE_INVALID",
      `channelsOverride for ${kind} resolves to no supported channel`
    )
  }
  return [...selected].sort(
    (left, right) =>
      CHANNEL_SEND_ORDER.indexOf(left) - CHANNEL_SEND_ORDER.indexOf(right)
  )
}

export function channelEnabled(input: {
  kind: NotificationKind
  channel: NotificationChannel
  preferences: PreferenceRow[]
}): boolean {
  const category = NOTIFICATION_KINDS[input.kind].category
  if (
    (REQUIRED_NOTIFICATION_CATEGORIES as readonly string[]).includes(category)
  ) {
    return true
  }
  const row = input.preferences.find(
    (preference) =>
      preference.channel === input.channel && preference.category === category
  )
  if (!row) return true
  return row.enabled
}
