import { redirect } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { professionalBodyById } from "@eleva/config/professional-bodies"
import { getLatestPartnerApplication } from "@eleva/db"
import {
  ClockIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "@eleva/icons"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { licenceVerificationState } from "@/lib/licence-verification"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { LicenceForm } from "./licence-form"

export const dynamic = "force-dynamic"

const STATE_ICONS = {
  verified: SealCheckIcon,
  pending: ClockIcon,
  needs_changes: WarningIcon,
  rejected: WarningIcon,
  unsubmitted: ShieldCheckIcon,
} as const

export default async function LicencePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "expert:onboard"
  )
  const application = await getLatestPartnerApplication(
    profile.orgId,
    profile.id
  )
  const state = licenceVerificationState(profile, application)
  if (!state) redirect(expertWorkspacePath(session))

  const [t, tFields, format] = await Promise.all([
    getTranslations("licence.page"),
    getTranslations("licence.fields"),
    getFormatter(),
  ])
  const listed = profile.status === "active"
  const Icon = STATE_ICONS[state]
  const details = application ?? {
    professionalBody: profile.professionalBody ?? "",
    licenceNumber: profile.licenceNumber ?? "",
    ersRegistrationNumber: profile.ersRegistrationNumber ?? "",
  }
  const bodyName =
    professionalBodyById(details.professionalBody)?.name ??
    details.professionalBody
  const canSubmit =
    state === "needs_changes" || state === "rejected" || state === "unsubmitted"

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        className="mb-0"
        title={t("title")}
        description={t("description")}
      />

      <section
        aria-labelledby="licence-state-title"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-1"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon weight="duotone" className="size-6" />
        </span>
        <div className="space-y-1">
          <h2
            id="licence-state-title"
            className="font-heading text-xl text-balance"
          >
            {t(`${state}.title`)}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {state === "verified"
              ? t("verified.body", {
                  date: application?.reviewedAt
                    ? format.dateTime(application.reviewedAt, {
                        dateStyle: "long",
                      })
                    : "",
                })
              : t(`${state}.body`, { body: bodyName })}
          </p>
        </div>

        {state === "pending" ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t("pending.nextTitle")}</h3>
            <ol className="list-decimal space-y-1 ps-5 text-sm text-pretty">
              {(t.raw("pending.next") as string[]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-sm text-pretty text-muted-foreground">
              {listed ? t("pending.meanwhileListed") : t("pending.meanwhile")}
            </p>
          </div>
        ) : null}

        {(state === "needs_changes" || state === "rejected") &&
        application?.reason ? (
          <Alert>
            <AlertTitle>{t("reasonLabel")}</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {application.reason}
            </AlertDescription>
          </Alert>
        ) : null}

        {state === "pending" || state === "verified" ? (
          <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">{tFields("body")}</dt>
              <dd className="font-medium">{bodyName}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">
                {tFields("licenceNumber")}
              </dt>
              <dd className="font-medium tabular-nums">
                {details.licenceNumber}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">{tFields("ersNumber")}</dt>
              <dd className="font-medium tabular-nums">
                {details.ersRegistrationNumber}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {canSubmit ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-1">
          <LicenceForm
            initial={{
              professionalBody: details.professionalBody,
              licenceNumber: details.licenceNumber,
              ersRegistrationNumber: details.ersRegistrationNumber,
            }}
            submitLabel={state === "unsubmitted" ? t("submit") : t("resubmit")}
          />
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t.rich("support", {
          link: (chunks) => (
            <a
              href="mailto:support@eleva.care"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  )
}
