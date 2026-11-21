import { getTranslations } from "next-intl/server"
import { getClinicSummary } from "@eleva/auth"
import { resolveTeamWorkspaceBase } from "@eleva/auth/org-routing"
import { getSessionForOrg } from "@eleva/auth/server"
import {
  CLINIC_STANDING_TONES,
  clinicStanding,
  type ClinicStanding,
} from "@eleva/config/clinic-verification"
import { ShieldIcon, UsersIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"

/**
 * The standings in which verification waits on the clinic. While Eleva is
 * checking, or once the clinic is verified, the Overview says nothing.
 */
const NEEDS_THE_CLINIC = [
  "not-sent",
  "change-needed",
  "verified-change-needed",
  "not-verified",
  "verified-new-rejected",
] as const satisfies readonly ClinicStanding[]

type NoticeStanding = (typeof NEEDS_THE_CLINIC)[number]

function needsTheClinic(standing: ClinicStanding): standing is NoticeStanding {
  return (NEEDS_THE_CLINIC as readonly ClinicStanding[]).includes(standing)
}

export default async function TeamAdminDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const [session, t, tVerification] = await Promise.all([
    getSessionForOrg(orgSlug),
    getTranslations("dashboard"),
    getTranslations("verification"),
  ])
  const base = resolveTeamWorkspaceBase(orgSlug)
  // Only the people who can act on it (clinic:manage) are told. If the
  // standing cannot be read, the Overview still opens, without the card.
  const summary =
    session && session.capabilities.includes("clinic:manage")
      ? await getClinicSummary(session.orgId, session.user.id).catch(
          (err: unknown) => {
            console.error("[team] overview could not read verification", err)
            return null
          }
        )
      : null
  const standing = summary
    ? clinicStanding(summary.verified, summary.verification?.status ?? null)
    : null
  const notice = standing && needsTheClinic(standing) ? standing : null

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {notice ? (
        <section
          aria-labelledby="overview-verification-title"
          className="flex flex-wrap items-start gap-4 rounded-3xl border bg-card p-6"
          data-testid="overview-verification"
          data-standing={notice}
        >
          {/* Icon and text stay together; only the button wraps under them. */}
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-4">
            <ShieldIcon
              aria-hidden
              className="mt-1 size-5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 space-y-2">
              <StatusPill tone={CLINIC_STANDING_TONES[notice]}>
                {tVerification(`standing.${notice}.pill`)}
              </StatusPill>
              <h2
                id="overview-verification-title"
                className="text-lg font-medium text-foreground"
              >
                {t(`verification.${notice}.title`)}
              </h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                {t(`verification.${notice}.body`)}
              </p>
            </div>
          </div>
          {/* What waits on the clinic is the page's main action. */}
          <LinkButton
            href={`${base}/verification`}
            size="sm"
            className="max-sm:w-full"
          >
            {t("verification.open")}
          </LinkButton>
        </section>
      ) : null}
      <EmptyState
        icon={<UsersIcon />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={
          <LinkButton
            href={`${base}/members`}
            size="sm"
            variant={notice ? "outline" : "default"}
          >
            {t("openTeam")}
          </LinkButton>
        }
      />
    </div>
  )
}
