import type { StatusTone } from "@eleva/ui/components/status-pill"

export type ClinicFilingStatus =
  | "pending"
  | "needs_changes"
  | "approved"
  | "rejected"

export const FILING_STATUS_TONES: Record<ClinicFilingStatus, StatusTone> = {
  pending: "attention",
  needs_changes: "neutral",
  approved: "positive",
  rejected: "neutral",
}
