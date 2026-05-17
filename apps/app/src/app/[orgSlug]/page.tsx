import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSessionForOrg, type ElevaSession } from "@eleva/auth"

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)

  switch (session.productLabel) {
    case "member":
      return <MemberDashboard session={session} />
    case "expert":
      redirect(`/${orgSlug}/expert`)
    case "team_admin":
      redirect(`/${orgSlug}/team`)
    case "staff":
      redirect("/admin")
  }
}

async function MemberDashboard({ session }: { session: ElevaSession }) {
  const t = await getTranslations()
  return (
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
  )
}
