import { getLocale, getTranslations } from "next-intl/server"
import {
  AI_PROCESSING_CONSENT_DOCUMENT,
  getPendingAccountDeletion,
} from "@eleva/compliance"
import { isLocale } from "@eleva/config/i18n"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"
import { PrivacyPanel } from "../_components/privacy-panel"

export const dynamic = "force-dynamic"

export default async function PrivacyPage() {
  const locale = await getLocale()
  const aiProcessingNoticeHref = isLocale(locale)
    ? AI_PROCESSING_CONSENT_DOCUMENT.urls[locale]
    : AI_PROCESSING_CONSENT_DOCUMENT.urls.en
  const session = await requireMemberSpace()
  const apiPromise = getAuthedApiClient()
  const consentsPromise = apiPromise.then((api) => api.me.listConsents())
  const recordAccessPromise = apiPromise.then((api) =>
    api.me.listRecordAccessOptouts()
  )
  const [t, { consents }, { choices: recordAccessChoices }, pendingDeletion] =
    await Promise.all([
      getTranslations("privacy"),
      consentsPromise,
      recordAccessPromise,
      getPendingAccountDeletion(session.user.id),
    ])

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PrivacyPanel
        consents={consents}
        scheduledFor={pendingDeletion?.scheduledFor.toISOString() ?? null}
        aiProcessingNoticeHref={aiProcessingNoticeHref}
        recordAccessChoices={recordAccessChoices}
      />
    </div>
  )
}
