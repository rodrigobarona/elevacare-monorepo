import { defineConsentConfig as c15tDefineConsentConfig } from "c15t/next"

import { consentI18n } from "./consent-i18n"
import { getC15tBackendUrl } from "./env"

/** Public Inth hosted runtime (org `eleva`, project `eleva-care`). */
export const DEFAULT_C15T_BACKEND_URL = "https://eleva-care-eleva.inth.app"

type C15tConfig = Parameters<typeof c15tDefineConsentConfig>[0]

export function defineConsentConfig(config: C15tConfig = {}) {
  const backendURL =
    config.backendURL ?? getC15tBackendUrl() ?? DEFAULT_C15T_BACKEND_URL

  return c15tDefineConsentConfig({
    ...config,
    backendURL,
    options: {
      ...config.options,
      i18n: {
        ...consentI18n,
        ...config.options?.i18n,
        messages: {
          ...consentI18n.messages,
          ...config.options?.i18n?.messages,
        },
      },
    },
  })
}
