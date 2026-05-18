import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"
import { LayoutDashboard, BookOpen, BarChart3, Settings } from "lucide-react"
import { DashboardShell } from "@eleva/dashboard/dashboard-shell"
import { buildDashboardConfig } from "@eleva/dashboard/config-helpers"
import { LAST_ACTIVE_ORG_COOKIE } from "@eleva/config/routing"

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

  const jar = await cookies()
  jar.set(LAST_ACTIVE_ORG_COOKIE, orgSlug, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
  })

  const t = await getTranslations("nav")

  const base = `/${orgSlug}/academy`
  const dashboardConfig = await buildDashboardConfig(session, [
    {
      items: [
        { title: t("dashboard"), url: base, icon: <LayoutDashboard /> },
        { title: t("courses"), url: `${base}/courses`, icon: <BookOpen /> },
        {
          title: t("analytics"),
          url: `${base}/analytics`,
          icon: <BarChart3 />,
        },
        {
          title: t("settings"),
          url: `${base}/settings`,
          icon: <Settings />,
        },
      ],
    },
  ])

  return <DashboardShell config={dashboardConfig}>{children}</DashboardShell>
}
