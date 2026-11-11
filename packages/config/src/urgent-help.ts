/**
 * Emergency and support lines shown wherever members book, wait for or
 * read about a session. Single source for the numbers: copy in the apps
 * and emails names a line by its key and never types a number itself.
 *
 * Sessions on Eleva are booked ahead, so anything urgent is sent to 112,
 * which reaches emergency services free of charge in every EU country.
 * Each language's copy names the national lines its readers are most
 * likely to need, always with the country ("In Portugal, SNS 24 …"), so
 * the sentence stays true wherever the reader is.
 *
 * Sources (checked 2026-11-11): sns24.gov.pt (SNS 24 and 1411),
 * portugal.gov.pt (1411, since 2025-09-10), sanidad.gob.es/linea024.
 */

export interface UrgentHelpNumber {
  /** The number as people read and dial it. */
  display: string
  /** `tel:` link target. Short codes are dialled as they are. */
  href: string
}

export const URGENT_HELP_NUMBERS = {
  /** 112: emergency services, free of charge, in every EU country. */
  emergency: { display: "112", href: "tel:112" },
  /** Portugal: SNS 24, health advice by phone. */
  sns24: { display: "808 24 24 24", href: "tel:808242424" },
  /** Portugal: national suicide prevention line, free, 24 hours. */
  prevention1411: { display: "1411", href: "tel:1411" },
  /** Spain: line for suicidal thoughts and those close by, free, 24 hours. */
  linea024: { display: "024", href: "tel:024" },
} as const satisfies Record<string, UrgentHelpNumber>

export type UrgentHelpLine = keyof typeof URGENT_HELP_NUMBERS

export const URGENT_HELP_LINES = Object.keys(
  URGENT_HELP_NUMBERS
) as UrgentHelpLine[]

export function isUrgentHelpLine(value: string): value is UrgentHelpLine {
  return Object.prototype.hasOwnProperty.call(URGENT_HELP_NUMBERS, value)
}
