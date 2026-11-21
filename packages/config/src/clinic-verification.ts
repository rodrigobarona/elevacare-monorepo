/**
 * What Eleva staff confirm before a clinic's public page goes live
 * (Phase 11). The staff queue UI is Phase 12; the DB requires every item to
 * be `true` on an approved `clinic_verifications` row.
 */
export const CLINIC_CHECKLIST_ITEMS = [
  /** The legal entity exists and is active (Portal da Empresa / registry). */
  "legal_entity_checked",
  /** The NIF / VAT number belongs to that entity (VIES for EU VAT). */
  "tax_id_checked",
] as const

export type ClinicChecklistItem = (typeof CLINIC_CHECKLIST_ITEMS)[number]

/** Public registers staff use to check a clinic's legal name and NIF. */
export const COMPANY_REGISTER_URL = "https://publicacoes.mj.pt/Pesquisa.aspx"
export const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/"

/**
 * A staff decision on a clinic's identity needs a browser session that
 * started within this window: a session left open for days cannot decide.
 * A working day, so a reviewer signs in once in the morning.
 */
export const STAFF_DECISION_SIGN_IN_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * A clinic's NIF or EU VAT number as it is stored: "PT 515 001 708" →
 * "PT515001708". Null when it cannot be one (8 to 32 letters and digits
 * once spaces, dots and dashes are gone). The form, the API and the domain
 * all read this one rule.
 */
export function normalizeClinicTaxId(raw: string): string | null {
  const value = raw.replace(/[\s.-]/g, "").toUpperCase()
  return /^[A-Z0-9]{8,32}$/.test(value) ? value : null
}

export type ClinicFilingStatus =
  | "pending"
  | "needs_changes"
  | "approved"
  | "rejected"

/** Where a clinic's verification stands, as its Verification page words it. */
export type ClinicStanding =
  | "not-sent"
  | "checking"
  | "change-needed"
  | "verified"
  | "verified-checking"
  | "verified-change-needed"
  | "verified-new-rejected"
  | "not-verified"

/**
 * `verified` is whether an approved filing exists; `status` is the state of
 * the open or newest filing. A verified clinic stays verified whatever
 * happens to newer details.
 */
export function clinicStanding(
  verified: boolean,
  status: ClinicFilingStatus | null
): ClinicStanding {
  if (verified) {
    if (status === "pending") return "verified-checking"
    if (status === "needs_changes") return "verified-change-needed"
    // The newest details were refused; an earlier approval still stands.
    if (status === "rejected") return "verified-new-rejected"
    return "verified"
  }
  if (status === "pending") return "checking"
  if (status === "needs_changes") return "change-needed"
  if (status === "rejected") return "not-verified"
  return "not-sent"
}
