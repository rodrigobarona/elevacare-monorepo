import { getTranslations } from "next-intl/server"
import { getPendingAccountDeletion } from "@eleva/compliance"
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
  const session = await requireMemberOrg(orgSlug)
  const apiPromise = getAuthedApiClient()
  const consentsPromise = apiPromise.then((api) => api.me.listConsents())
  const [t, { consents }, pendingDeletion] = await Promise.all([
    getTranslations("privacy"),
    consentsPromise,
    getPendingAccountDeletion(session.user.id),
  ])

  return (
    <div className="space-y-8">
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <PrivacyPanel
        orgSlug={orgSlug}
        consents={consents}
        scheduledFor={pendingDeletion?.scheduledFor.toISOString() ?? null}
      />
    </div>
  )
}
