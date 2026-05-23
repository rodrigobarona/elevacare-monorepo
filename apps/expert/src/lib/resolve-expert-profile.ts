import type { ElevaSession } from "@eleva/auth"
import type { ExpertProfile } from "@eleva/db"
import { getExpertProfileForOrg } from "@eleva/db"
import { EnsureExpertProfileResponseSchema } from "@eleva/api-client"
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

  const trimmedDisplayName = session.user.displayName?.trim()
  const displayName =
    trimmedDisplayName || session.user.email.split("@")[0]?.trim() || orgSlug

  const api = await getAuthedApiClient()
  const result = await api.experts.profile.ensure({
    orgSlug,
    displayName,
  })

  const ensured = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (ensured) return ensured

  const parsed = EnsureExpertProfileResponseSchema.shape.profile.safeParse(
    result.profile
  )
  if (!parsed.success) {
    throw new Error("Expert profile ensure returned an invalid profile shape")
  }

  throw new Error("Expert profile ensured but could not be loaded from DB")
}
