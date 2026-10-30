import type { LicenceReviewStateValue } from "@eleva/api-client"
import type { StatusTone } from "@eleva/ui/components/status-pill"

export const REVIEW_STATE_TONES: Record<LicenceReviewStateValue, StatusTone> = {
  pending: "attention",
  needs_changes: "neutral",
  needs_verification: "attention",
  verified: "positive",
  rejected: "neutral",
  not_submitted: "neutral",
}
