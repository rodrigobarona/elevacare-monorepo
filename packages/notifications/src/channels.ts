import { NOTIFICATION_KINDS, type NotificationKind } from "./kinds"
import { SendNotificationError } from "./errors"

export const NOTIFICATION_CHANNELS = ["email", "sms", "in_app"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const REQUIRED_NOTIFICATION_CATEGORIES = ["payment", "system"] as const

/** Spec fan-out order: in-app, then email (SMS is a later slice). */
export const CHANNEL_SEND_ORDER = ["in_app", "email"] as const

export type PreferenceRow = {
  channel: NotificationChannel
  category: "booking" | "reminder" | "payment" | "marketing" | "system"
  enabled: boolean
}

/**
 * SMS is claimed and sent in a later Phase 08 PR (Twilio EU). This
 * slice only delivers email (Resend) and in-app inbox rows.
 */
export function supportedSendChannels(
  kind: NotificationKind,
  channelsOverride: NotificationChannel[] | undefined
): Array<Exclude<NotificationChannel, "sms">> {
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
  const selected = (channelsOverride ?? [...allowed]).filter(
    (channel): channel is Exclude<NotificationChannel, "sms"> =>
      channel !== "sms"
  )
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
  channel: Exclude<NotificationChannel, "sms">
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
