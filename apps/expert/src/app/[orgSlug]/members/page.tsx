import Link from "next/link"
import { getFormatter, getTranslations } from "next-intl/server"
import { listExpertMembers } from "@eleva/db"
import { CaretRightIcon, UsersIcon } from "@eleva/icons"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { expertWorkspacePath } from "@/lib/workspace-paths"

export const dynamic = "force-dynamic"

export default async function ExpertMembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const [t, format, members] = await Promise.all([
    getTranslations("members"),
    getFormatter(),
    listExpertMembers(profile.orgId, profile.id),
  ])

  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" })

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          {members.map((member) => {
            const key = member.memberUserId ?? member.email ?? member.name
            const body = (
              <>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">
                    {member.name ?? t("unnamed")}
                  </p>
                  {member.email ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  ) : null}
                </div>
                <div className="hidden text-right text-sm text-muted-foreground sm:block">
                  <p>{t("sessionCount", { count: member.sessionCount })}</p>
                  <p>
                    {member.nextSessionAt
                      ? t("nextSession", { date: date(member.nextSessionAt) })
                      : member.lastSessionAt
                        ? t("lastSession", {
                            date: date(member.lastSessionAt),
                          })
                        : null}
                  </p>
                </div>
              </>
            )
            return (
              <li key={key} data-testid="expert-member-row">
                {member.memberUserId ? (
                  <Link
                    href={expertWorkspacePath(
                      session,
                      `members/${member.memberUserId}`
                    )}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 sm:px-6"
                  >
                    {body}
                    <CaretRightIcon aria-hidden className="size-4" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 p-4 sm:px-6">
                    {body}
                    <span className="size-4" aria-hidden />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
