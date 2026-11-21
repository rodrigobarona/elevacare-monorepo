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

/** Public registers staff use to check a clinic's legal name and NIF. */
export const COMPANY_REGISTER_URL = "https://publicacoes.mj.pt/Pesquisa.aspx"
export const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/"
