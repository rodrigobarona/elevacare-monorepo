import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max"

function asCountryCode(country: string): CountryCode | undefined {
  const code = country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return undefined
  return code as CountryCode
}

export function callingCodeFor(country: string): string | null {
  const code = asCountryCode(country)
  if (!code) return null
  try {
    return getCountryCallingCode(code)
  } catch {
    return null
  }
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "")
}

export function toE164(raw: string, country: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  const parsed = parsePhoneNumberFromString(trimmed, asCountryCode(country))
  if (!parsed?.isValid()) return null
  return parsed.number
}

export function isE164(value: string): boolean {
  const parsed = parsePhoneNumberFromString(value.trim())
  return parsed?.isValid() === true
}

export function maskPhone(e164: string): string {
  const value = normalizePhone(e164)
  if (value.length < 6) return value
  return `${value.slice(0, 4)} ··· ${value.slice(-3)}`
}
