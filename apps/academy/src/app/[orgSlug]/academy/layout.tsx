import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
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

  const t = await getTranslations("nav")

  const base = `/${orgSlug}/academy`
  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [{ title: t("dashboard"), url: base, icon: "SquaresFourIcon" }],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
