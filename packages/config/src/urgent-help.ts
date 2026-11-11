/**
 * Emergency and health-advice lines shown wherever members book, wait for
 * or read about a session. Single source for the numbers: copy in the apps
 * and emails takes them from here and never types a number itself.
 *
 * Sessions on Eleva are booked ahead, so anything urgent is sent to 112,
 * which reaches emergency services free of charge in every EU country.
 * The national line is the one the copy of that language names ("In
 * Portugal, SNS 24 …"), so it reads correctly wherever the reader is.
 */

export interface UrgentHelpNumber {
  /** The number as people read and dial it. */
  display: string
  /** `tel:` link target. Short codes are dialled as they are. */
  href: string
}

/** 112: emergency services, free of charge, in every EU country. */
export const EU_EMERGENCY_NUMBER: UrgentHelpNumber = {
  display: "112",
  href: "tel:112",
}

/** Portugal: SNS 24, health advice and psychological support, 24 hours. */
const SNS_24: UrgentHelpNumber = {
  display: "808 24 24 24",
  href: "tel:808242424",
}

/** Spain: 024, the 24-hour line for people thinking about suicide. */
const LINEA_024: UrgentHelpNumber = {
  display: "024",
  href: "tel:024",
}

export interface UrgentHelpNumbers {
  emergency: UrgentHelpNumber
  /** The national line that language's copy names, when it names one. */
  national: UrgentHelpNumber | null
}

/** Numbers for the copy of `locale`; `pt-BR` and `pt-PT` read as `pt`. */
export function urgentHelpNumbers(locale: string): UrgentHelpNumbers {
  const language = locale.toLowerCase().split("-")[0]
  if (language === "pt") {
    return { emergency: EU_EMERGENCY_NUMBER, national: SNS_24 }
  }
  if (language === "es") {
    return { emergency: EU_EMERGENCY_NUMBER, national: LINEA_024 }
  }
  return { emergency: EU_EMERGENCY_NUMBER, national: null }
}
