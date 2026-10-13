/**
 * Private-store pathname for a booking document.
 * Spec: records/<expertOrgId>/<memberUserId>/
 * Guest bookings without a member user use guest-<bookingId>.
 */
export function sessionDocumentPrefix(input: {
  orgId: string
  memberUserId: string | null
  bookingId: string
}): string {
  const subject = input.memberUserId ?? `guest-${input.bookingId}`
  return `records/${input.orgId}/${subject}/`
}

export function isSessionDocumentPathname(
  pathname: string,
  prefix: string
): boolean {
  if (!pathname.startsWith(prefix)) return false
  const rest = pathname.slice(prefix.length)
  if (!rest || rest.includes("..") || rest.startsWith("/")) return false
  if (rest.includes("//")) return false
  return !rest.split("/").some((part) => part === "." || part === "..")
}
