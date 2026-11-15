import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"
import { AcceptInvitation } from "./accept-invitation"

/**
 * Where an organization invitation email lands (Phase 11). The account
 * proxy sends signed-out visitors to sign in first and back here; the
 * invitation itself is read, accepted or declined through Better Auth's
 * organization endpoints, which check the recipient email and expiry.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const session = await getSession()
  if (!session) {
    const returnTo = `/accept-invitation?id=${encodeURIComponent(id ?? "")}`
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  }
  return (
    <Suspense>
      <AcceptInvitation
        invitationId={id ?? null}
        signedInEmail={session.user.email}
      />
    </Suspense>
  )
}
