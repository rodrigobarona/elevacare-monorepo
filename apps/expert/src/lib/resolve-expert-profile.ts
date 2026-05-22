import type { ElevaSession } from "@eleva/auth"
import type { ExpertProfile } from "@eleva/db"
import { getExpertProfileForOrg } from "@eleva/db"
import { getAuthedApiClient } from "@/lib/server-api"

export async function resolveExpertProfileForSession(
  session: ElevaSession
): Promise<ExpertProfile | null> {
  return getExpertProfileForOrg(session.user.id, session.orgId)
}

export async function resolveOrCreateExpertProfileForSession(
  session: ElevaSession,
  orgSlug: string
): Promise<ExpertProfile> {
  const existing = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (existing) return existing

  const api = await getAuthedApiClient()
  const result = await api.experts.profile.ensure({
    orgSlug,
    displayName:
      session.user.displayName ?? session.user.email.split("@")[0] ?? orgSlug,
  })

  const ensured = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (ensured) return ensured

  return result.profile as ExpertProfile
}
