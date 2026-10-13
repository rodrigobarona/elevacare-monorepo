const CANCEL_RE =
  /local-screen-share-canceled|permission denied by user|aborterror/i
const SCREEN_SHARE_RE = /screenshare|screen-share|screen share/i

function errorText(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return `${value.name} ${value.message}`
  if (!value || typeof value !== "object") return ""
  const rec = value as {
    errorMsg?: unknown
    message?: unknown
    name?: unknown
    type?: unknown
    error?: unknown
  }
  return [rec.errorMsg, rec.message, rec.name, rec.type, rec.error]
    .map((part) => errorText(part))
    .filter(Boolean)
    .join(" ")
}

/** User dismissed the OS picker, or the browser blocked getDisplayMedia. */
export function isScreenShareCanceled(error: unknown): boolean {
  return CANCEL_RE.test(errorText(error))
}

/** Daily logs a console.error when the picker is closed without sharing. */
export function isScreenShareCancelLog(args: unknown[]): boolean {
  const text = args.map((arg) => errorText(arg) || String(arg)).join(" ")
  return SCREEN_SHARE_RE.test(text) && CANCEL_RE.test(text)
}
