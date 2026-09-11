import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { PrivacyPanel } from "../_components/privacy-panel"

export const dynamic = "force-dynamic"

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await requireMemberOrg(orgSlug)
  const [t, api] = await Promise.all([
    getTranslations("privacy"),
    getAuthedApiClient(),
  ])
  const { consents } = await api.me.listConsents()

  return (
    <div className="space-y-8">
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <PrivacyPanel orgSlug={orgSlug} consents={consents} />
    </div>
  )
}
