import { Section, Text } from "react-email"
import { EmailLayout } from "../components/layout"
import { DetailRow } from "../components/detail-row"
import {
  getEmailTranslations,
  type EmailLocale,
  type EmailTranslations,
} from "../i18n"

export type InvoiceClosedGateStatus = "blocked" | "skipped" | "pending"

export interface InvoiceClosedGateProps {
  status: InvoiceClosedGateStatus
  invoiceId: string
  name?: string
  error?: string | null
  locale?: EmailLocale
}

const STATUS_LABEL: Record<
  InvoiceClosedGateStatus,
  Record<EmailLocale, string>
> = {
  blocked: { en: "Blocked", pt: "Bloqueada", es: "Bloqueada" },
  skipped: { en: "Skipped", pt: "Omitida", es: "Omitida" },
  pending: { en: "Pending", pt: "Pendente", es: "Pendiente" },
}

function copyForStatus(
  t: EmailTranslations,
  status: InvoiceClosedGateStatus
): { title: string; subtitle: string; subject: string } {
  switch (status) {
    case "blocked":
      return {
        title: t.invoice.blockedTitle,
        subtitle: t.invoice.blockedSubtitle,
        subject: t.subject.invoiceBlocked,
      }
    case "skipped":
      return {
        title: t.invoice.skippedTitle,
        subtitle: t.invoice.skippedSubtitle,
        subject: t.subject.invoiceSkipped,
      }
    case "pending":
      return {
        title: t.invoice.pendingTitle,
        subtitle: t.invoice.pendingSubtitle,
        subject: t.subject.invoicePending,
      }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function reasonForError(
  t: EmailTranslations,
  status: InvoiceClosedGateStatus,
  error: string | null | undefined
): string {
  switch (error) {
    case "toconline_v1_auto_finalize_blocked":
      return t.invoice.reasons.toconline_v1_auto_finalize_blocked
    case "zero_fee":
      return t.invoice.reasons.zero_fee
    case "iva_lookup_unavailable":
      return t.invoice.reasons.iva_lookup_unavailable
    default:
      return status === "skipped"
        ? t.invoice.reasons.genericSkipped
        : t.invoice.reasons.generic
  }
}

export function InvoiceClosedGateEmail({
  status,
  invoiceId,
  name,
  error,
  locale = "en",
}: InvoiceClosedGateProps) {
  const t = getEmailTranslations(locale)
  const copy = copyForStatus(t, status)

  return (
    <EmailLayout preview={copy.subject} locale={locale}>
      <Section className="border-stroke bg-bg rounded-xl border p-8">
        <Text className="text-fg m-0 mb-1 text-[22px] leading-tight font-semibold tracking-tight">
          {copy.title}
        </Text>
        {name ? (
          <Text className="text-fg-3 m-0 mb-4 text-[14px] leading-relaxed">
            {t.invoice.greeting(name)}
          </Text>
        ) : null}
        <Text className="text-fg-3 m-0 mb-6 text-[14px] leading-relaxed">
          {copy.subtitle}
        </Text>

        <Section className="bg-bg-2 rounded-lg p-5">
          <DetailRow
            label={t.labels.status}
            value={STATUS_LABEL[status][locale]}
            bold
          />
          <DetailRow label={t.labels.reference} value={invoiceId} />
          <DetailRow
            label={t.labels.reason}
            value={reasonForError(t, status, error)}
          />
        </Section>
      </Section>
    </EmailLayout>
  )
}

InvoiceClosedGateEmail.PreviewProps = {
  status: "blocked",
  invoiceId: "00000000-0000-4000-8000-000000000001",
  name: "Ana",
  error: "toconline_v1_auto_finalize_blocked",
  locale: "pt",
} satisfies InvoiceClosedGateProps

export default InvoiceClosedGateEmail
