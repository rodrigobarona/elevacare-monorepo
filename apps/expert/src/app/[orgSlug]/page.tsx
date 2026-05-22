import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSessionForOrg } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { ensureExpertProfileForOrg, getExpertProfileForOrg } from "@eleva/db"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { redirectToMemberOrg } from "@/lib/gateway-redirects"

export const dynamic = "force-dynamic"

const GATEWAY_URL = resolveGatewayUrl()

export default async function ExpertDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)
  if (!session.capabilities.includes("events:manage")) {
    redirect(`${GATEWAY_URL}/${orgSlug}`)
  }

  let profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    profile = await ensureExpertProfileForOrg({
      userId: session.user.id,
      orgId: session.orgId,
      orgSlug,
      displayName: session.user.displayName ?? session.user.email,
    })
  }

  if (requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session, "setup"))
  }

  const t = await getTranslations()
  return (
    <AccountPageHeader
      title={t("dashboard.expert.welcome", {
        name: session.user.displayName ?? session.user.email,
      })}
      description={t("dashboard.expert.subtitle")}
    />
  )
}
