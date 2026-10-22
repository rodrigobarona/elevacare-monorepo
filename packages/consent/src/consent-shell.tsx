import { cookieName, defaultLocale, isLocale } from "@eleva/config/i18n"
import { ConsentTheme } from "c15t/next"
import { cookies } from "next/headers"
import type { ReactNode } from "react"

import { ConsentChrome } from "./consent-chrome"
import { elevaConsentTheme } from "./eleva-theme"
import { ConsentRoot, resolveConsent } from "./next"

/** Wrap root layout children + mount banner/dialog (server component). */
export async function ConsentShell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const rawLocale = cookieStore.get(cookieName)?.value
  const language = rawLocale && isLocale(rawLocale) ? rawLocale : defaultLocale

  const testCountry =
    process.env.NODE_ENV !== "production"
      ? process.env.ELEVA_CONSENT_TEST_COUNTRY?.trim()
      : undefined

  return (
    <>
      <ConsentTheme theme={elevaConsentTheme} />
      <ConsentRoot
        state={resolveConsent({
          language,
          ...(testCountry ? { country: testCountry } : {}),
        })}
      >
        {children}
        <ConsentChrome />
      </ConsentRoot>
    </>
  )
}
