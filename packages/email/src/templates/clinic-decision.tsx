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

export type ClinicDecisionKind =
  | "clinic.verified"
  | "clinic.needs_changes"
  | "clinic.rejected"

export interface ClinicDecisionProps {
  kind: ClinicDecisionKind
  /** The clinic's Verification page. */
  verificationHref: string
  clinicName: string
  /** What staff found; set when a change is asked or the details refused. */
  reason?: string | null
  /**
   * The clinic is verified once this decision is recorded. A clinic verified
   * before stays verified when its newer details are not confirmed.
   */
  verified?: boolean
  name?: string
  locale?: EmailLocale
}

export function clinicDecisionCopy(
  t: EmailTranslations,
  kind: ClinicDecisionKind,
  verified = false
): { title: string; subtitle: string; subject: string } {
  switch (kind) {
    case "clinic.verified":
      return {
        title: t.clinic.verifiedTitle,
        subtitle: t.clinic.verifiedSubtitle,
        subject: t.subject.clinicVerified,
      }
    case "clinic.needs_changes":
      return {
        title: t.clinic.needsChangesTitle,
        subtitle: verified
          ? t.clinic.needsChangesStillVerifiedSubtitle
          : t.clinic.needsChangesSubtitle,
        subject: t.subject.clinicNeedsChanges,
      }
    case "clinic.rejected":
      // Never tell a verified clinic it "could not be verified".
      return verified
        ? {
            title: t.clinic.rejectedStillVerifiedTitle,
            subtitle: t.clinic.rejectedStillVerifiedSubtitle,
            subject: t.subject.clinicRejectedStillVerified,
          }
        : {
            title: t.clinic.rejectedTitle,
            subtitle: t.clinic.rejectedSubtitle,
            subject: t.subject.clinicRejected,
          }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function ClinicDecisionEmail({
  kind,
  verificationHref,
  clinicName,
  reason,
  verified = false,
  name,
  locale = "en",
}: ClinicDecisionProps) {
  const t = getEmailTranslations(locale)
  const copy = clinicDecisionCopy(t, kind, verified)

  return (
    <EmailLayout preview={copy.subject} locale={locale}>
      <EmailHeading>{copy.title}</EmailHeading>
      {name ? (
        <EmailBodyText className="mb-[8px]">
          {t.invoice.greeting(name)}
        </EmailBodyText>
      ) : null}
      <EmailBodyText className="mb-[24px]">{copy.subtitle}</EmailBodyText>
      <EmailCard>
        <DetailRow label={t.clinic.clinicLabel} value={clinicName} />
        {reason ? (
          <DetailRow label={t.clinic.reasonLabel} value={reason} />
        ) : null}
      </EmailCard>
      <EmailButton href={verificationHref}>{t.clinic.cta}</EmailButton>
    </EmailLayout>
  )
}

ClinicDecisionEmail.PreviewProps = {
  kind: "clinic.needs_changes",
  verificationHref: "https://eleva.care/team/clinica-lumen/verification",
  clinicName: "Clínica Lumen",
  reason: "The legal name in the register is Clínica Lumen, Unipessoal Lda.",
  name: "Ana",
  locale: "en",
} satisfies ClinicDecisionProps

export default ClinicDecisionEmail
