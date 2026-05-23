import type { main } from "@eleva/db"

/** Expert must finish onboarding before accessing the main dashboard. */
export function requiresExpertOnboarding(
  profile: main.ExpertProfile | null
): boolean {
  if (!profile) return true
  return profile.status === "draft" || profile.status === "approved"
}
