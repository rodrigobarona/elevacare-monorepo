import { withConsentManifest } from "c15t/next/build"

/** Public Inth hosted runtime (org `eleva`, project `eleva-care`). */
const DEFAULT_C15T_BACKEND_URL = "https://eleva-care-eleva.inth.app"

/**
 * Wrap Next.js config for c15t manifest bundling. Defaults to `runtime` on
 * manifest fetch failure so CI builds without Inth URL still succeed.
 */
export function withElevaConsentManifest(config, options = {}) {
  if (!process.env.NEXT_PUBLIC_C15T_BACKEND_URL?.trim()) {
    process.env.NEXT_PUBLIC_C15T_BACKEND_URL = DEFAULT_C15T_BACKEND_URL
  }
  if (!process.env.NEXT_PUBLIC_INTH_PROJECT_URL?.trim()) {
    process.env.NEXT_PUBLIC_INTH_PROJECT_URL = DEFAULT_C15T_BACKEND_URL
  }

  const onBuildError =
    process.env.C15T_ON_BUILD_ERROR === "fail" ? "fail" : "runtime"
  return withConsentManifest(config, { onBuildError, ...options })
}
