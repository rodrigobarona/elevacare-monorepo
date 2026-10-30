/**
 * Portuguese professional bodies (Ordens) whose members Eleva may list at
 * launch (decision log 2026-10-29 "Launch legal posture": regulated health
 * professionals only, licence verified by Eleva staff).
 *
 * `name` is the official Portuguese name and is shown untranslated in every
 * locale. `website` is the Ordem's official site, where staff check the
 * public register (Lei 2/2013 art. 19 makes the register public).
 */
export const PROFESSIONAL_BODIES = [
  {
    id: "ordem_medicos",
    name: "Ordem dos Médicos",
    website: "https://ordemdosmedicos.pt",
  },
  {
    id: "ordem_psicologos",
    name: "Ordem dos Psicólogos Portugueses",
    website: "https://www.ordemdospsicologos.pt",
  },
  {
    id: "ordem_nutricionistas",
    name: "Ordem dos Nutricionistas",
    website: "https://www.ordemdosnutricionistas.pt",
  },
  {
    id: "ordem_fisioterapeutas",
    name: "Ordem dos Fisioterapeutas",
    website: "https://ordemdosfisioterapeutas.pt",
  },
  {
    id: "ordem_enfermeiros",
    name: "Ordem dos Enfermeiros",
    website: "https://www.ordemenfermeiros.pt",
  },
  {
    id: "ordem_medicos_dentistas",
    name: "Ordem dos Médicos Dentistas",
    website: "https://www.omd.pt",
  },
  {
    id: "ordem_farmaceuticos",
    name: "Ordem dos Farmacêuticos",
    website: "https://www.ordemfarmaceuticos.pt",
  },
] as const

export type ProfessionalBody = (typeof PROFESSIONAL_BODIES)[number]
export type ProfessionalBodyId = ProfessionalBody["id"]

export const PROFESSIONAL_BODY_IDS = PROFESSIONAL_BODIES.map(
  (body) => body.id
) as [ProfessionalBodyId, ...ProfessionalBodyId[]]

/** Entidade Reguladora da Saúde: providers must be registered (DL 127/2014). */
export const ERS_WEBSITE = "https://www.ers.pt"

export function isProfessionalBodyId(
  value: string | null | undefined
): value is ProfessionalBodyId {
  return PROFESSIONAL_BODY_IDS.some((id) => id === value)
}

export function professionalBodyById(
  id: string | null | undefined
): ProfessionalBody | null {
  return PROFESSIONAL_BODIES.find((body) => body.id === id) ?? null
}

/** Licence (cédula) number as issued by the Ordem: letters, digits, `.`, `/`, `-`, spaces. */
export const LICENCE_NUMBER_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9./ -]*[A-Za-z0-9])?$/
export const LICENCE_NUMBER_MAX_LENGTH = 64

/** ERS registration number from the certificate of registration. */
export const ERS_REGISTRATION_NUMBER_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9./-]*[A-Za-z0-9])?$/
export const ERS_REGISTRATION_NUMBER_MAX_LENGTH = 32

/**
 * Staff licence-verification checklist. Every item must be confirmed before
 * an application is approved; `register_checked` is also enforced by a DB
 * CHECK on `become_partner_applications` (status = 'approved').
 */
export const LICENCE_CHECKLIST_ITEMS = [
  /** Licence found, active, in the Ordem's public register. */
  "register_checked",
  /** Name on the register matches the expert's identity. */
  "name_matches",
  /** ERS registration number confirmed with the ERS. */
  "ers_checked",
] as const

export type LicenceChecklistItem = (typeof LICENCE_CHECKLIST_ITEMS)[number]
