/**
 * Private-store pathname for a booking document.
 * Spec: records/<expertOrgId>/<memberUserId>/<actorUserId>/
 * Guest bookings without a member user use guest-<bookingId>.
 * The actor segment binds completion to the uploader who minted the token.
 */
export function sessionDocumentPrefix(input: {
  orgId: string
  memberUserId: string | null
  bookingId: string
  actorUserId: string
}): string {
  const subject = input.memberUserId ?? `guest-${input.bookingId}`
  return `records/${input.orgId}/${subject}/${input.actorUserId}/`
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
