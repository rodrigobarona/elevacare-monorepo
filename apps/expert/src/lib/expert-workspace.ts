import { redirect } from "next/navigation"
import type { ElevaSession } from "@eleva/auth"
import { guardSessionForOrg } from "@eleva/auth"
import type { ExpertProfile } from "@eleva/db"
import { ensureExpertProfileForOrg, getExpertProfileForOrg } from "@eleva/db"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
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

  let profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    profile = await ensureExpertProfileForOrg({
      userId: session.user.id,
      orgId: session.orgId,
      orgSlug,
      displayName: session.user.displayName ?? session.user.email,
    })
  }

  if (requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session, "setup"))
  }

  return { session, profile, orgSlug }
}
