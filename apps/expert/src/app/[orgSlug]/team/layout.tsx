import { redirect, notFound } from "next/navigation"
import { getSessionForOrg } from "@eleva/auth/server"
import { resolveTeamAdminBase } from "@eleva/auth/org-routing"

/** Clinic expert tools live under /:slug/team; managers use /:slug/admin. */
export default async function ClinicExpertSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)

  if (!session) {
    notFound()
  }

  if (session.productLabel === "team_admin") {
    redirect(resolveTeamAdminBase(orgSlug))
  }

  if (session.productLabel !== "expert") {
    notFound()
  }

  return children
}
