import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { getClinicSummary } from "@eleva/auth"
import { getSessionForOrg } from "@eleva/auth/server"
import {
  CLINIC_STANDING_TONES,
  clinicStanding,
} from "@eleva/config/clinic-verification"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { VerificationForm } from "./verification-form"

/** The standing's title: focus lands here after details are sent. */
const STANDING_TITLE_ID = "verification-standing-title"

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
  const standing = clinicStanding(summary.verified, filing?.status ?? null)
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
  // A verified clinic with nothing open starts from empty fields; every
  // other standing shows what was sent, ready to correct.
  const prefill = standing !== "verified"
  // Under a "Verified" pill, say which details these are: the ones we
  // checked, or newer ones that are not confirmed.
  const sentCaption =
    standing === "verified"
      ? t("sent.captionVerified")
      : summary.verified
        ? t("sent.captionNew")
        : t("sent.caption")

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-8">
        <section
          className="space-y-4 rounded-2xl border bg-card p-6"
          data-testid="verification-standing"
          data-standing={standing}
        >
          <StatusPill tone={CLINIC_STANDING_TONES[standing]}>
            {t(`standing.${standing}.pill`)}
          </StatusPill>
          <div className="space-y-2">
            <h2
              id={STANDING_TITLE_ID}
              tabIndex={-1}
              className="rounded-sm text-xl font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
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
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium text-foreground">
                {sentCaption}
              </h3>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("sent.legalName")}
                  </dt>
                  <dd className="font-medium break-words">
                    {filing.legalName}
                  </dd>
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
            </div>
          ) : null}
        </section>

        <section className="space-y-4" aria-labelledby="verification-form">
          <div className="space-y-1">
            <h2
              id="verification-form"
              // The standing above already says it when nothing was sent.
              className={
                standing === "not-sent"
                  ? "sr-only"
                  : "text-lg font-medium text-foreground"
              }
            >
              {formFirst
                ? t("form.heading")
                : waiting
                  ? t("form.headingCorrect")
                  : standing === "verified-new-rejected"
                    ? t("form.headingRefused")
                    : t("form.headingChanged")}
            </h2>
            {formFirst ? null : (
              <p className="text-sm text-muted-foreground">
                {waiting
                  ? t("form.correctHelp")
                  : standing === "verified-new-rejected"
                    ? t("form.refusedHelp")
                    : t("form.changedHelp")}
              </p>
            )}
          </div>
          <VerificationForm
            // A new filing state resets what the form shows.
            key={`${filing?.id ?? "none"}:${filing?.status ?? "none"}:${filing?.submittedAt.getTime() ?? 0}`}
            sent={
              filing
                ? { legalName: filing.legalName, taxId: filing.taxId }
                : null
            }
            prefill={prefill}
            waitForChange={waiting}
            intent={
              standing === "not-sent"
                ? "first"
                : standing === "verified"
                  ? "new"
                  : "correction"
            }
            // The main action only when sending details is the next step.
            primary={formFirst}
            focusAfterSendId={STANDING_TITLE_ID}
          />
        </section>
      </div>
    </div>
  )
}
