export function pickUniqueEmailMatch<T extends { email: string }>(
  rows: T[],
  email: string
): T | null {
  if (rows.length === 0) return null
  if (rows.length === 1) return rows[0] ?? null
  const exact = rows.filter((row) => row.email === email)
  if (exact.length === 1) return exact[0] ?? null
  throw new Error("AMBIGUOUS_USER_EMAIL")
}
