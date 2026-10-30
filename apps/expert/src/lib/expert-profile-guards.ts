import { hasFinishedExpertSetup } from "@eleva/api-client"
import type { main } from "@eleva/db"

/**
 * Expert must finish setup before accessing the main dashboard. A finished
 * `approved` profile (licence awaiting staff verification) may use the
 * dashboard to prepare services; it is not listed until `active`.
 */
export function requiresExpertOnboarding(
  profile: main.ExpertProfile | null
): boolean {
  if (!profile) return true
  if (profile.status === "draft") return true
  return (
    profile.status === "approved" &&
    !hasFinishedExpertSetup(profile.metadata as Record<string, unknown> | null)
  )
}
