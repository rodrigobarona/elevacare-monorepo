import { DetailRow } from "../components/detail-row"
import { EmailButton } from "../components/email-button"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { EmailLayout } from "../components/layout"
import {
  getEmailTranslations,
  type EmailLocale,
  type EmailTranslations,
} from "../i18n"

export type PartnerDecisionKind =
  | "partner.approved"
  | "partner.needs_changes"
  | "partner.rejected"

export interface PartnerDecisionProps {
  kind: PartnerDecisionKind
  licenceHref: string
  /** Staff reason; set on needs changes and rejected. */
  reason?: string | null
  name?: string
  locale?: EmailLocale
}

export function partnerDecisionCopy(
  t: EmailTranslations,
  kind: PartnerDecisionKind
): { title: string; subtitle: string; subject: string } {
  switch (kind) {
    case "partner.approved":
      return {
        title: t.partner.approvedTitle,
        subtitle: t.partner.approvedSubtitle,
        subject: t.subject.partnerApproved,
      }
    case "partner.needs_changes":
      return {
        title: t.partner.needsChangesTitle,
        subtitle: t.partner.needsChangesSubtitle,
        subject: t.subject.partnerNeedsChanges,
      }
    case "partner.rejected":
      return {
        title: t.partner.rejectedTitle,
        subtitle: t.partner.rejectedSubtitle,
        subject: t.subject.partnerRejected,
      }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function PartnerDecisionEmail({
  kind,
  licenceHref,
  reason,
  name,
  locale = "en",
}: PartnerDecisionProps) {
  const t = getEmailTranslations(locale)
  const copy = partnerDecisionCopy(t, kind)

  return (
    <EmailLayout preview={copy.subject} locale={locale}>
      <EmailHeading>{copy.title}</EmailHeading>
      {name ? (
        <EmailBodyText className="mb-[8px]">
          {t.invoice.greeting(name)}
        </EmailBodyText>
      ) : null}
      <EmailBodyText className="mb-[24px]">{copy.subtitle}</EmailBodyText>
      {reason ? (
        <EmailCard>
          <DetailRow label={t.partner.reasonLabel} value={reason} />
        </EmailCard>
      ) : null}
      <EmailButton href={licenceHref}>{t.partner.cta}</EmailButton>
    </EmailLayout>
  )
}

PartnerDecisionEmail.PreviewProps = {
  kind: "partner.needs_changes",
  licenceHref: "https://eleva.care/fisiomota/licence",
  reason: "The licence number does not match the register.",
  name: "Ana",
  locale: "en",
} satisfies PartnerDecisionProps

export default PartnerDecisionEmail
