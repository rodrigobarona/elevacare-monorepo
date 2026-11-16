import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
import { resolveAcademyWorkspaceBase } from "@eleva/auth/org-routing"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"

export default async function AcademyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)

  if (session.orgSlug !== orgSlug) {
    notFound()
  }

  // `/academy/{slug}` only serves academy workspaces (ADR-026).
  if (session.productLabel !== "lecturer") {
    notFound()
  }

  const t = await getTranslations("nav")

  const base = resolveAcademyWorkspaceBase(orgSlug)
  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [{ title: t("dashboard"), url: base, icon: "SquaresFourIcon" }],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
