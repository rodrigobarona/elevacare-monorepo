/**
 * Better Auth error codes → the security page's own messages, so a member
 * never reads the library's English text. Anything unknown is generic.
 */
export function authErrorKey(
  error: { code?: string | null } | null | undefined
): "errors.password" | "errors.code" | "error" {
  const code = error?.code ?? ""
  if (code.includes("PASSWORD")) return "errors.password"
  if (code.includes("CODE") || code.includes("OTP") || code.includes("TOTP")) {
    return "errors.code"
  }
  return "error"
}
