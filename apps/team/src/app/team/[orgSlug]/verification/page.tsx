import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { getClinicSummary } from "@eleva/auth"
import { getSessionForOrg } from "@eleva/auth/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill, type StatusTone } from "@eleva/ui/components/status-pill"
import { VerificationForm } from "./verification-form"

/** Where the clinic's verification stands, as the page words it. */
type Standing =
  | "not-sent"
  | "checking"
  | "change-needed"
  | "verified"
  | "verified-checking"
  | "verified-change-needed"
  | "verified-new-rejected"
  | "not-verified"

const TONES: Record<Standing, StatusTone> = {
  "not-sent": "neutral",
  checking: "attention",
  "change-needed": "attention",
  verified: "positive",
  "verified-checking": "positive",
  "verified-change-needed": "positive",
  "verified-new-rejected": "positive",
  "not-verified": "neutral",
}

function standingOf(
  verified: boolean,
  status: "pending" | "needs_changes" | "approved" | "rejected" | null
): Standing {
  if (verified) {
    if (status === "pending") return "verified-checking"
    if (status === "needs_changes") return "verified-change-needed"
    // The newest details were refused; an earlier approval still stands.
    if (status === "rejected") return "verified-new-rejected"
    return "verified"
  }
  if (status === "pending") return "checking"
  if (status === "needs_changes") return "change-needed"
  if (status === "rejected") return "not-verified"
  return "not-sent"
}

export default async function TeamVerificationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)
  if (!session || !session.capabilities.includes("clinic:manage")) notFound()

  const [summary, t, format] = await Promise.all([
    getClinicSummary(session.orgId, session.user.id),
    getTranslations("verification"),
    getFormatter(),
  ])
  const filing = summary.verification
  const standing = standingOf(summary.verified, filing?.status ?? null)
  const date = (value: Date) =>
    format.dateTime(value, { day: "numeric", month: "long", year: "numeric" })
  // The form is offered whenever sending details is the next step, and for
  // a verified clinic whose legal identity has changed.
  const formFirst =
    standing === "not-sent" ||
    standing === "change-needed" ||
    standing === "verified-change-needed" ||
    standing === "not-verified"
  const waiting = standing === "checking" || standing === "verified-checking"

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-8">
        <section
          className="space-y-4 rounded-2xl border bg-card p-6"
          data-testid="verification-standing"
          data-standing={standing}
        >
          <StatusPill tone={TONES[standing]}>
            {t(`standing.${standing}.pill`)}
          </StatusPill>
          <div className="space-y-2">
            <h2 className="text-xl font-medium text-foreground">
              {t(`standing.${standing}.title`)}
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              {t(`standing.${standing}.body`)}
            </p>
          </div>

          {filing?.reason ? (
            <div className="rounded-xl bg-muted p-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("reasonTitle")}
              </h3>
              <p
                className="mt-1 text-base whitespace-pre-line text-foreground"
                data-testid="verification-reason"
              >
                {filing.reason}
              </p>
            </div>
          ) : null}

          {filing ? (
            <dl className="grid gap-4 border-t pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">
                  {t("sent.legalName")}
                </dt>
                <dd className="font-medium break-words">{filing.legalName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  {t("sent.taxId")}
                </dt>
                <dd className="font-mono">{filing.taxId}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  {filing.status === "approved" && filing.reviewedAt
                    ? t("sent.verifiedOn")
                    : t("sent.sentOn")}
                </dt>
                <dd>
                  {date(
                    filing.status === "approved" && filing.reviewedAt
                      ? filing.reviewedAt
                      : filing.submittedAt
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="space-y-4" aria-labelledby="verification-form">
          <div className="space-y-1">
            <h2
              id="verification-form"
              className="text-lg font-medium text-foreground"
            >
              {formFirst
                ? t("form.heading")
                : waiting
                  ? t("form.headingCorrect")
                  : t("form.headingChanged")}
            </h2>
            {formFirst ? null : (
              <p className="text-sm text-muted-foreground">
                {waiting ? t("form.correctHelp") : t("form.changedHelp")}
              </p>
            )}
          </div>
          <VerificationForm
            // A new filing state resets what the form shows.
            key={`${filing?.id ?? "none"}:${filing?.status ?? "none"}:${filing?.submittedAt.getTime() ?? 0}`}
            legalName={formFirst || waiting ? (filing?.legalName ?? "") : ""}
            taxId={formFirst || waiting ? (filing?.taxId ?? "") : ""}
            resend={filing !== null}
          />
        </section>
      </div>
    </div>
  )
}
