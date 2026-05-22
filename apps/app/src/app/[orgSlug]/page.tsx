import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSessionForOrg, type ElevaSession } from "@eleva/auth"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)

  if (session.orgSlug !== orgSlug || session.productLabel !== "member") {
    redirect(resolveProductHomeUrl(session))
  }

  return <MemberDashboard session={session} />
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
