/**
 * The apex domain still serves the previous Eleva app until the v3 cutover
 * (decision log 2026-11-10, "Apex is not trusted until it serves v3"). v3
 * trusts it for credentialed CORS, CSRF and Server Actions only when
 * `ELEVA_APEX_IS_V3=true`, which the cutover sets in every v3 project.
 */
export const APEX_HOSTS = ["eleva.care", "www.eleva.care"] as const

export const APEX_IS_V3_ENV = "ELEVA_APEX_IS_V3"

type ApexEnv = { ELEVA_APEX_IS_V3?: string; [key: string]: string | undefined }

export function apexServesV3(env: ApexEnv = process.env): boolean {
  return env.ELEVA_APEX_IS_V3?.trim() === "true"
}

export function isApexHost(host: string): boolean {
  return (APEX_HOSTS as readonly string[]).includes(host.toLowerCase())
}

/** Whether `origin` may be trusted: apex origins only once it serves v3. */
export function apexAllowed(origin: string, env: ApexEnv = process.env) {
  try {
    return !isApexHost(new URL(origin).hostname) || apexServesV3(env)
  } catch {
    return false
  }
}
