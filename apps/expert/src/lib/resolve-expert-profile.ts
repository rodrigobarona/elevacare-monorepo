import { ensureExpertProfileForOrg, getExpertProfileForOrg } from "@eleva/db"
import type { main } from "@eleva/db"
import type { ElevaSession } from "@eleva/auth"

export async function resolveExpertProfileForSession(
  session: ElevaSession
): Promise<main.ExpertProfile | null> {
  return getExpertProfileForOrg(session.user.id, session.orgId)
}

export async function resolveOrCreateExpertProfileForSession(
  session: ElevaSession,
  orgSlug: string
): Promise<main.ExpertProfile> {
  const existing = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (existing) return existing

  return ensureExpertProfileForOrg({
    userId: session.user.id,
    orgId: session.orgId,
    orgSlug,
    displayName:
      session.user.displayName ?? session.user.email.split("@")[0] ?? orgSlug,
  })
}
