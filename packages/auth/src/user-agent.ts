/**
 * Turns a session's User-Agent string into the words people use for their
 * devices ("Chrome on macOS", "Safari on iPhone"), for the signed-in
 * devices list. Order matters: Edge and Opera also say "Chrome", Chrome also
 * says "Safari", and iPadOS can report itself as a Mac.
 */
export interface DeviceDescription {
  browser: string | null
  os: string | null
  /** Coarse device class, for picking an icon. */
  kind: "phone" | "tablet" | "computer"
}

const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\/|\bChrome\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
]

const SYSTEMS: Array<[RegExp, string, DeviceDescription["kind"]]> = [
  [/\biPhone\b/, "iPhone", "phone"],
  [/\biPad\b/, "iPad", "tablet"],
  [/\bAndroid\b.*\bMobile\b/, "Android", "phone"],
  [/\bAndroid\b/, "Android", "tablet"],
  [/\bWindows\b/, "Windows", "computer"],
  [/\bCrOS\b/, "ChromeOS", "computer"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS", "computer"],
  [/\bLinux\b/, "Linux", "computer"],
]

export function describeUserAgent(
  userAgent: string | null | undefined
): DeviceDescription {
  const ua = userAgent ?? ""
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua))
  return {
    browser,
    os: system?.[1] ?? null,
    kind: system?.[2] ?? "computer",
  }
}
