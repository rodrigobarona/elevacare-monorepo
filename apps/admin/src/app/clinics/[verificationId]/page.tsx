import Link from "next/link"
import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { ApiClientError } from "@eleva/api-client"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { getAuthedApiClient } from "@/lib/server-api"
import {
  COMPANY_REGISTER_URL,
  FILING_STATUS_TONES,
  VIES_URL,
} from "../filing-status-tones"
import { DecisionForm } from "./decision-form"

export const dynamic = "force-dynamic"

async function loadReview(verificationId: string) {
  const api = await getAuthedApiClient()
  try {
    return await api.admin.clinics.get(verificationId)
  } catch (err) {
    if (
      err instanceof ApiClientError &&
      (err.status === 404 || err.status === 422)
    ) {
      notFound()
    }
    throw err
  }
}

export default async function ClinicReviewPage({
  params,
}: {
  params: Promise<{ verificationId: string }>
}) {
  const { verificationId } = await params
  const [review, t, format] = await Promise.all([
    loadReview(verificationId),
    getTranslations("clinics"),
    getFormatter(),
  ])
  const { verification, clinic, owner, history } = review
  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    })
  const address = [
    clinic.billingAddress.line1,
    clinic.billingAddress.line2,
    [clinic.billingAddress.postalCode, clinic.billingAddress.city]
      .filter(Boolean)
      .join(" "),
    clinic.billingAddress.country,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/clinics"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("detail.back")}
      </Link>
      <PageHeader
        title={clinic.displayName}
        description={
          owner
            ? t("detail.description", {
                owner: owner.name,
                email: owner.email,
                people: review.people,
              })
            : t("detail.descriptionNoOwner", { people: review.people })
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={FILING_STATUS_TONES[verification.status]}>
          {t(`states.${verification.status}`)}
        </StatusPill>
        {review.verified && verification.status !== "approved" ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.verifiedNote")}
          </p>
        ) : null}
      </div>

      <section className="space-y-4 rounded-xl border p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            {t("detail.snapshotTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("detail.sentAt", { date: formatDate(verification.submittedAt) })}
            {verification.reviewedAt
              ? ` · ${t("detail.reviewedAt", {
                  date: formatDate(verification.reviewedAt),
                })}`
              : ""}
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("detail.legalName")}
            </dt>
            <dd className="font-medium">{verification.legalName}</dd>
            <a
              href={COMPANY_REGISTER_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              {t("detail.openRegister")}
            </a>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("detail.taxId")}
            </dt>
            <dd className="font-mono">{verification.taxId}</dd>
            <a
              href={VIES_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              {t("detail.openVies")}
            </a>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("detail.address")}
            </dt>
            <dd className="whitespace-pre-line">
              {address.length > 0 ? address.join("\n") : t("detail.notGiven")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("detail.website")}
            </dt>
            <dd>
              {clinic.websiteUrl ? (
                <a
                  href={clinic.websiteUrl}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="break-all underline underline-offset-4"
                >
                  {clinic.websiteUrl}
                </a>
              ) : (
                t("detail.notGiven")
              )}
            </dd>
          </div>
          {verification.reason ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">
                {t("detail.lastReason")}
              </dt>
              <dd className="whitespace-pre-line">{verification.reason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {verification.status === "pending" ? (
        <section className="space-y-4 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">
            {t("detail.decisionTitle")}
          </h2>
          <DecisionForm
            key={verification.submittedAt}
            verificationId={verification.id}
            submittedAt={verification.submittedAt}
          />
        </section>
      ) : (
        <Alert>
          <AlertDescription data-testid="clinic-filing-note">
            {t(`detail.notes.${verification.status}`)}
          </AlertDescription>
        </Alert>
      )}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            {t("detail.historyTitle")}
          </h2>
          <ul className="divide-y rounded-xl border">
            {history.map((filing) => (
              <li
                key={filing.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{filing.legalName}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono">{filing.taxId}</span>
                    {" · "}
                    {t("detail.sentAt", {
                      date: formatDate(filing.submittedAt),
                    })}
                  </p>
                </div>
                <StatusPill tone={FILING_STATUS_TONES[filing.status]}>
                  {t(`states.${filing.status}`)}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
