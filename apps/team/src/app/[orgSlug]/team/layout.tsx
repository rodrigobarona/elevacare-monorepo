import { redirect, notFound } from "next/navigation"
import { getSessionForOrg } from "@eleva/auth/server"
import { LOGIN_PATH } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"

const GATEWAY_URL = resolveGatewayUrl()

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  if (!session) {
    const returnTo = encodeURIComponent(`/${orgSlug}/team`)
    redirect(`${GATEWAY_URL}${LOGIN_PATH}?returnTo=${returnTo}`)
  }

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  if (session.productLabel !== "team_admin") {
    notFound()
  }

  return <>{children}</>
}
