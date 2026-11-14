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
