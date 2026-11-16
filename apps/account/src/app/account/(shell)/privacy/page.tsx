import { getLocale, getTranslations } from "next-intl/server"
import { requireSession } from "@eleva/auth/server"
import {
  AI_PROCESSING_CONSENT_DOCUMENT,
  CONSENT_DOCUMENTS,
  getLatestDsarRequestForUser,
  getPendingAccountDeletion,
} from "@eleva/compliance"
import { resolveGatewayUrl } from "@eleva/config/env"
import { isLocale } from "@eleva/config/i18n"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getPersonalApiClient } from "@/lib/personal-api"
import { PrivacyPanel } from "./privacy-panel"

export const dynamic = "force-dynamic"

export default async function PrivacyPage() {
  const [t, uiLocale, session, api] = await Promise.all([
    getTranslations("privacy"),
    getLocale(),
    requireSession(),
    getPersonalApiClient(),
  ])
  const locale = isLocale(uiLocale) ? uiLocale : "en"
  const gateway = resolveGatewayUrl()
  const [{ consents }, { choices }, pendingDeletion, latestDataCopy] =
    await Promise.all([
      api.me.listConsents(),
      api.me.listRecordAccessOptouts(),
      getPendingAccountDeletion(session.user.id),
      getLatestDsarRequestForUser(session.user.id),
    ])

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PrivacyPanel
        consents={consents}
        currentVersion={CONSENT_DOCUMENTS.terms.version}
        recordAccessChoices={choices}
        scheduledFor={pendingDeletion?.scheduledFor.toISOString() ?? null}
        latestDataCopy={latestDataCopy}
        documentUrls={{
          terms: `${gateway}${CONSENT_DOCUMENTS.terms.urls[locale]}`,
          privacy: `${gateway}${CONSENT_DOCUMENTS.privacy.urls[locale]}`,
          health_data_processing: `${gateway}${CONSENT_DOCUMENTS.health_data_processing.urls[locale]}`,
          ai_processing: `${gateway}${AI_PROCESSING_CONSENT_DOCUMENT.urls[locale]}`,
        }}
      />
    </div>
  )
}
