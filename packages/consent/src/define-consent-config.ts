import { defineConsentConfig as c15tDefineConsentConfig } from "c15t/next"

import { consentI18n } from "./consent-i18n"
import { elevaConsentActions, elevaConsentComponents } from "./eleva-theme"
import { getC15tBackendUrl } from "./env"

/**
 * The only optional cookies Eleva uses are marketing, for the Beehiiv
 * newsletter form (cookie policy). The dialog offers just these, not the
 * policy's full default scope (analytics, experience, functionality).
 */
export const ELEVA_CONSENT_CATEGORIES = ["necessary", "marketing"] as const

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
      consentCategories: [...ELEVA_CONSENT_CATEGORIES],
      ...config.options,
      theme: {
        consentActions: elevaConsentActions,
        ...config.options?.theme,
      },
      components: {
        ...elevaConsentComponents,
        ...config.options?.components,
      },
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
