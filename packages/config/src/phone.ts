/** Keeps the calling code and last three digits: `+351 ··· 678`. */
export function maskPhone(e164: string): string {
  const value = e164.replace(/[^\d+]/g, "")
  if (value.length < 6) return value
  return `${value.slice(0, 4)} ··· ${value.slice(-3)}`
}
