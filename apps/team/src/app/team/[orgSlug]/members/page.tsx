import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getClinicSummary, listTeamMembers } from "@eleva/auth"
import { getSessionForOrg } from "@eleva/auth/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { TeamRoster } from "./team-roster"

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)
  if (!session || !session.capabilities.includes("members:manage")) notFound()

  const t = await getTranslations("members")
  const [roster, clinic] = await Promise.all([
    listTeamMembers(session.orgId),
    getClinicSummary(session.orgId, session.user.id),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />
      <TeamRoster
        clinicName={clinic.profile.displayName}
        currentUserId={session.user.id}
        members={roster.members.map((member) => ({
          memberId: member.memberId,
          userId: member.userId,
          name: member.name,
          email: member.email,
          image: member.image,
          role: member.role,
          publishedServices: member.publishedServices,
        }))}
        invitations={roster.invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          expired: invitation.expired,
          invitedByName: invitation.invitedByName,
        }))}
      />
    </div>
  )
}
