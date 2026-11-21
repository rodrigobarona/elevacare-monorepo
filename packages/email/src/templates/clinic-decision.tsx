import { Section, Text } from "react-email"
import { DetailRow } from "../components/detail-row"
import { EmailButton } from "../components/email-button"
import { EmailCard } from "../components/email-card"
import { EmailBodyText, EmailHeading } from "../components/email-heading"
import { EmailLayout } from "../components/layout"
import { emailSafeName } from "../safe-name"
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
): { title: string; subtitle: string; subject: string; cta: string } {
  switch (kind) {
    case "clinic.verified":
      return {
        title: t.clinic.verifiedTitle,
        subtitle: t.clinic.verifiedSubtitle,
        subject: t.subject.clinicVerified,
        cta: t.clinic.ctaSee,
      }
    case "clinic.needs_changes":
      return {
        title: t.clinic.needsChangesTitle,
        subtitle: verified
          ? t.clinic.needsChangesStillVerifiedSubtitle
          : t.clinic.needsChangesSubtitle,
        subject: t.subject.clinicNeedsChanges,
        cta: t.clinic.ctaCorrect,
      }
    case "clinic.rejected":
      // Never tell a verified clinic it "could not be verified".
      return verified
        ? {
            title: t.clinic.rejectedStillVerifiedTitle,
            subtitle: t.clinic.rejectedStillVerifiedSubtitle,
            subject: t.subject.clinicRejectedStillVerified,
            cta: t.clinic.ctaSee,
          }
        : {
            title: t.clinic.rejectedTitle,
            subtitle: t.clinic.rejectedSubtitle,
            subject: t.subject.clinicRejected,
            cta: t.clinic.ctaCorrect,
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
  // The clinic names itself: shown as one plain line, never as a link.
  const clinic = emailSafeName(clinicName)
  const greetingName = emailSafeName(name)

  return (
    <EmailLayout preview={copy.subtitle} locale={locale} accountFooter={false}>
      <EmailHeading>{copy.title}</EmailHeading>
      {greetingName ? (
        <EmailBodyText className="mb-[8px]">
          {t.invoice.greeting(greetingName)}
        </EmailBodyText>
      ) : null}
      <EmailBodyText className="mb-[24px]">{copy.subtitle}</EmailBodyText>
      {clinic || reason ? (
        <EmailCard>
          {clinic ? (
            <DetailRow label={t.clinic.clinicLabel} value={clinic} />
          ) : null}
          {reason ? (
            // What staff found is why this email exists: the full width,
            // with its line breaks, not a narrow column.
            <>
              <Text className="text-fg-3 m-0 mt-[8px] text-[13px] leading-[20px]">
                {t.clinic.reasonLabel}
              </Text>
              <Text className="text-fg m-0 text-[15px] leading-[24px] whitespace-pre-line">
                {reason}
              </Text>
            </>
          ) : null}
        </EmailCard>
      ) : null}
      <Section className="mt-[24px]">
        <EmailButton href={verificationHref}>{copy.cta}</EmailButton>
      </Section>
      {/* Why this person: they manage the clinic. */}
      <EmailBodyText className="mt-[24px] mb-0 text-[13px] leading-[20px]">
        {t.clinic.why(clinic ?? t.clinic.yourClinic)}
      </EmailBodyText>
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
