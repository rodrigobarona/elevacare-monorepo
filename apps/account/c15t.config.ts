import { DEFAULT_C15T_BACKEND_URL } from "@eleva/consent"
import { defineConsentConfig } from "@eleva/consent"

export default defineConsentConfig({
  backendURL:
    process.env.NEXT_PUBLIC_C15T_BACKEND_URL?.trim() ||
    DEFAULT_C15T_BACKEND_URL,
})
