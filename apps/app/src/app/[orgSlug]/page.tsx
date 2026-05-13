import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { AppShell } from "@/components/app-shell"

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSession()
  if (!session) redirect("/signin")

  switch (session.productLabel) {
    case "member":
      return <MemberDashboard session={session} />
    case "expert":
      return <ExpertHome session={session} orgSlug={orgSlug} />
    case "clinic_admin":
      return <ClinicAdminDashboard session={session} />
    case "eleva_operator":
      redirect(`/${orgSlug}/admin`)
  }
}

async function MemberDashboard({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
}) {
  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">
          {t("dashboard.member.welcome", {
            name: session.user.displayName ?? session.user.email,
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.member.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}

async function ExpertHome({
  session,
  orgSlug,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
  orgSlug: string
}) {
  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile || profile.status === "draft" || profile.status === "approved") {
    redirect(`/${orgSlug}/expert/onboarding`)
  }

  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">
          {t("dashboard.expert.welcome", {
            name: session.user.displayName ?? session.user.email,
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.expert.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}

async function ClinicAdminDashboard({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
}) {
  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">
          {t("dashboard.org.welcome", {
            name: session.user.displayName ?? session.user.email,
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.org.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}
