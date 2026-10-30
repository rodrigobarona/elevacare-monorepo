import { hasFinishedExpertSetup } from "@eleva/api-client"
import type { main } from "@eleva/db"

export type LicenceVerificationState =
  | "verified"
  | "pending"
  | "needs_changes"
  | "rejected"
  | "unsubmitted"

/**
 * Where the expert stands on licence verification (decision log
 * 2026-10-29), or null while setup is unfinished / the profile is
 * suspended. `unsubmitted` covers profiles listed before the gate.
 */
export function licenceVerificationState(
  profile: main.ExpertProfile,
  application: main.BecomePartnerApplication | null
): LicenceVerificationState | null {
  const finished =
    profile.status === "active" ||
    (profile.status === "approved" &&
      hasFinishedExpertSetup(
        profile.metadata as Record<string, unknown> | null
      ))
  if (!finished) return null
  if (!application) return "unsubmitted"
  return application.status === "approved" ? "verified" : application.status
}
