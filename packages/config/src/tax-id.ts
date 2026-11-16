/**
 * Tax identification numbers for the country an expert practises in.
 * Eleva prints the expert's number on the service-fee invoices it issues
 * them, so a typo has to be caught before it reaches an invoice.
 *
 * PT: NIF/NIPC, 9 digits with a mod-11 check digit.
 * ES: DNI (8 digits + letter), NIE (X/Y/Z + 7 digits + letter) or CIF
 *     (letter + 7 digits + control).
 * BR: CPF (11 digits) or CNPJ (14 digits), both with check digits.
 * Elsewhere: 4 to 20 letters or digits, without a checksum.
 */

export type TaxIdCountry = "PT" | "ES" | "BR"

/** Drops spaces, dots, dashes and slashes, a leading country prefix, and uppercases. */
export function normalizeTaxId(value: string, country?: string | null): string {
  const compact = value.replace(/[\s.\-/]/g, "").toUpperCase()
  const prefix = country?.toUpperCase()
  if (prefix && compact.startsWith(prefix) && compact.length > prefix.length) {
    const rest = compact.slice(prefix.length)
    if (/^[0-9A-Z]+$/.test(rest)) return rest
  }
  return compact
}

function isPortugueseNif(value: string): boolean {
  if (!/^[0-9]{9}$/.test(value)) return false
  const digits = [...value].map(Number)
  const sum = digits
    .slice(0, 8)
    .reduce((total, digit, index) => total + digit * (9 - index), 0)
  const check = 11 - (sum % 11)
  return digits[8] === (check >= 10 ? 0 : check)
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

function isSpanishTaxId(value: string): boolean {
  const dni = /^([0-9]{8})([A-Z])$/.exec(value)
  if (dni) return DNI_LETTERS[Number(dni[1]) % 23] === dni[2]
  const nie = /^([XYZ])([0-9]{7})([A-Z])$/.exec(value)
  if (nie) {
    const lead = String("XYZ".indexOf(nie[1]!))
    return DNI_LETTERS[Number(lead + nie[2]) % 23] === nie[3]
  }
  const cif = /^([ABCDEFGHJNPQRSUVW])([0-9]{7})([0-9A-J])$/.exec(value)
  if (cif) {
    const digits = [...cif[2]!].map(Number)
    let sum = 0
    digits.forEach((digit, index) => {
      if (index % 2 === 0) {
        const doubled = digit * 2
        sum += Math.floor(doubled / 10) + (doubled % 10)
      } else {
        sum += digit
      }
    })
    const control = (10 - (sum % 10)) % 10
    return cif[3] === String(control) || cif[3] === "JABCDEFGHI"[control]
  }
  return false
}

function brazilCheckDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((total, digit, i) => total + digit * weights[i]!, 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

function isBrazilianTaxId(value: string): boolean {
  if (!/^[0-9]+$/.test(value) || /^(\d)\1+$/.test(value)) return false
  const digits = [...value].map(Number)
  if (digits.length === 11) {
    const first = brazilCheckDigit(
      digits.slice(0, 9),
      [10, 9, 8, 7, 6, 5, 4, 3, 2]
    )
    const second = brazilCheckDigit(
      digits.slice(0, 10),
      [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    )
    return digits[9] === first && digits[10] === second
  }
  if (digits.length === 14) {
    const first = brazilCheckDigit(
      digits.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    )
    const second = brazilCheckDigit(
      digits.slice(0, 13),
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    )
    return digits[12] === first && digits[13] === second
  }
  return false
}

/** True when `value` is a well-formed tax number for `country`. */
export function isValidTaxId(value: string, country?: string | null): boolean {
  const normalized = normalizeTaxId(value, country)
  switch (country?.toUpperCase()) {
    case "PT":
      return isPortugueseNif(normalized)
    case "ES":
      return isSpanishTaxId(normalized)
    case "BR":
      return isBrazilianTaxId(normalized)
    default:
      return /^[0-9A-Z]{4,20}$/.test(normalized)
  }
}
