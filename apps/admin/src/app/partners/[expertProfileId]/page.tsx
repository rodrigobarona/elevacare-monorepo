import Link from "next/link"
import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { ApiClientError } from "@eleva/api-client"
import {
  ERS_WEBSITE,
  professionalBodyById,
} from "@eleva/config/professional-bodies"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { getAuthedApiClient } from "@/lib/server-api"
import { REVIEW_STATE_TONES } from "../review-state-tones"
import { DecisionForm } from "./decision-form"

export const dynamic = "force-dynamic"

async function loadReview(expertProfileId: string) {
  const api = await getAuthedApiClient()
  try {
    return await api.admin.partners.get(expertProfileId)
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

export default async function PartnerReviewPage({
  params,
}: {
  params: Promise<{ expertProfileId: string }>
}) {
  const { expertProfileId } = await params
  const [review, t, format] = await Promise.all([
    loadReview(expertProfileId),
    getTranslations("partners"),
    getFormatter(),
  ])
  const { application, reviewState } = review
  const body = professionalBodyById(application?.professionalBody)
  const canDecide = reviewState === "pending" || reviewState === "needs_changes"
  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    })

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/partners"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("detail.back")}
      </Link>
      <PageHeader
        title={review.displayName}
        description={t("detail.description", {
          email: review.email,
          username: review.username,
        })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={REVIEW_STATE_TONES[reviewState]}>
          {t(`states.${reviewState}`)}
        </StatusPill>
        {review.profileStatus === "active" && reviewState !== "verified" ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.listedNote")}
          </p>
        ) : null}
      </div>

      {application ? (
        <section className="space-y-4 rounded-xl border p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
              {t("detail.snapshotTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("detail.sentAt", {
                date: formatDate(application.submittedAt),
              })}
              {application.reviewedAt
                ? ` · ${t("detail.reviewedAt", {
                    date: formatDate(application.reviewedAt),
                  })}`
                : ""}
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">
                {t("detail.body")}
              </dt>
              <dd className="font-medium">
                {body?.name ?? application.professionalBody}
              </dd>
              {body ? (
                <a
                  href={body.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline underline-offset-4"
                >
                  {t("detail.openRegister", { body: body.name })}
                </a>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {t("detail.licenceNumber")}
              </dt>
              <dd className="font-mono">{application.licenceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {t("detail.ersNumber")}
              </dt>
              <dd className="font-mono">{application.ersRegistrationNumber}</dd>
              <a
                href={ERS_WEBSITE}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline underline-offset-4"
              >
                {t("detail.openErs")}
              </a>
            </div>
            {application.reason ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">
                  {t("detail.lastReason")}
                </dt>
                <dd className="whitespace-pre-line">{application.reason}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : (
        <Alert>
          <AlertDescription>{t("detail.noApplication")}</AlertDescription>
        </Alert>
      )}

      {application && canDecide ? (
        <section className="space-y-4 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">
            {t("detail.decisionTitle")}
          </h2>
          <DecisionForm
            key={application.submittedAt}
            expertProfileId={review.expertProfileId}
            applicationId={application.id}
            submittedAt={application.submittedAt}
          />
        </section>
      ) : null}
      {reviewState === "verified" ? (
        <Alert>
          <AlertDescription>{t("detail.approvedNote")}</AlertDescription>
        </Alert>
      ) : null}
      {application?.status === "rejected" ? (
        <Alert>
          <AlertDescription>{t("detail.rejectedNote")}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
