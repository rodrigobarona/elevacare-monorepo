import { notFound } from "next/navigation"
import { getFormatter, getLocale, getTranslations } from "next-intl/server"
import { z } from "zod"
import { pickLocalized } from "@eleva/config/i18n-locales"
import { getExpertMember } from "@eleva/db"
import { LinkButton } from "@eleva/ui/components/button"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { expertWorkspacePath } from "@/lib/workspace-paths"

export const dynamic = "force-dynamic"

const MemberIdSchema = z.string().uuid()

const REPORTABLE_STATUSES = new Set(["confirmed", "completed"])

export default async function ExpertMemberDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; memberUserId: string }>
}) {
  const { orgSlug, memberUserId } = await params
  const parsedId = MemberIdSchema.safeParse(memberUserId)
  if (!parsedId.success) notFound()

  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const [t, format, locale, member] = await Promise.all([
    getTranslations("members"),
    getFormatter(),
    getLocale(),
    getExpertMember(profile.orgId, profile.id, parsedId.data),
  ])
  if (!member) notFound()

  const now = new Date()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("detailEyebrow")}
        title={member.name ?? t("unnamed")}
        description={member.email ?? undefined}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-lg">{t("sessionsTitle")}</h2>
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          {member.sessions.map((booking) => {
            const upcoming = booking.startsAt.getTime() > now.getTime()
            return (
              <li
                key={booking.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {pickLocalized(booking.eventTypeTitle, locale)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(booking.startsAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <StatusPill tone={upcoming ? "attention" : "neutral"}>
                  {upcoming ? t("upcoming") : t("past")}
                </StatusPill>
                {REPORTABLE_STATUSES.has(booking.status) ? (
                  <LinkButton
                    variant="outline"
                    size="sm"
                    href={expertWorkspacePath(
                      session,
                      `sessions/${booking.id}/report`
                    )}
                  >
                    {t("openReport")}
                  </LinkButton>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <LinkButton
        variant="ghost"
        href={expertWorkspacePath(session, "members")}
      >
        {t("back")}
      </LinkButton>
    </div>
  )
}
