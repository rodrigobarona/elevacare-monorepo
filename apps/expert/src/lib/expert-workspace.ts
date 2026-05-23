import { redirect } from "next/navigation"
import type { ElevaSession } from "@eleva/auth"
import { guardSessionForOrg } from "@eleva/auth"
import type { ExpertProfile } from "@eleva/db"
import { getExpertProfileForOrg } from "@eleva/db"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
import { resolveOrCreateExpertProfileForSession } from "@/lib/resolve-expert-profile"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { redirectToMemberOrg } from "@/lib/gateway-redirects"

export interface ExpertWorkspaceContext {
  session: ElevaSession
  profile: ExpertProfile
  orgSlug: string
}

export async function loadExpertWorkspace(
  orgSlug: string,
  capability: string
): Promise<ExpertWorkspaceContext> {
  const session = await guardSessionForOrg(orgSlug)
  if (!session.capabilities.includes(capability)) {
    redirectToMemberOrg(orgSlug)
  }

  const profile = await resolveOrCreateExpertProfileForSession(session, orgSlug)

  if (requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session, "setup"))
  }

  return { session, profile, orgSlug }
}

export async function loadExpertProfileReadOnly(
  session: ElevaSession
): Promise<ExpertProfile | null> {
  return getExpertProfileForOrg(session.user.id, session.orgId)
}
