export const SEND_NOTIFICATION_ERROR_CODES = [
  "ORG_CONTEXT_REQUIRED",
  "USER_KIND_HAS_NO_ORG",
  "CHANNEL_OVERRIDE_INVALID",
  "USER_NOT_FOUND",
  "VALIDATION",
] as const

export type SendNotificationErrorCode =
  (typeof SEND_NOTIFICATION_ERROR_CODES)[number]

export class SendNotificationError extends Error {
  readonly code: SendNotificationErrorCode

  constructor(code: SendNotificationErrorCode, message: string) {
    super(message)
    this.name = "SendNotificationError"
    this.code = code
  }
}
