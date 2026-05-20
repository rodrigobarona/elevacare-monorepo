import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
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
      return redirect(`/${orgSlug}/expert`)
    case "team_admin":
      return redirect(`/${orgSlug}/team`)
    case "staff":
      return redirect("/admin")
  }
}

async function MemberDashboard({ session }: { session: ElevaSession }) {
  const t = await getTranslations()
  return (
    <AccountPageHeader
      title={t("dashboard.member.welcome", {
        name: session.user.displayName ?? session.user.email,
      })}
      description={t("dashboard.member.subtitle")}
    />
  )
}
