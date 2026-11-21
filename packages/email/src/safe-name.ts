/** Names shown in an email: one line, no links, at most 80 characters. */
export function emailSafeName(value: string | undefined): string | null {
  const name = (value ?? "")
    .replace(/https?:\/\/\S*|www\.\S*/gi, "")
    // Control and invisible formatting characters (bidi overrides too).
    .replace(/[\p{Cc}\p{Cf}<>]/gu, " ")
    // "name.tld" would be turned into a link by mail apps: break the dot.
    .replace(/([\p{L}\d])\.(?=[\p{L}\d])/gu, "$1 ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return name || null
}
