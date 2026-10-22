import { DEFAULT_C15T_BACKEND_URL, defineConsentConfig } from "@eleva/consent"

/** Script integrations (PostHog, GTM, …) register here — not in layout loaders. */
export default defineConsentConfig({
  backendURL:
    process.env.NEXT_PUBLIC_C15T_BACKEND_URL?.trim() ||
    DEFAULT_C15T_BACKEND_URL,
})
