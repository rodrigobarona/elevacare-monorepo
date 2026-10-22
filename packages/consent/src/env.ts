/** Inth hosted c15t runtime (org `eleva`, project `eleva-care`). */
export function getC15tBackendUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_C15T_BACKEND_URL?.trim()
  return raw || undefined
}

export function isConsentRuntimeConfigured(): boolean {
  return Boolean(getC15tBackendUrl())
}
