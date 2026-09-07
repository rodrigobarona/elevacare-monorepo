"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RouterProvider } from "react-aria-components"

type NextAppRouter = ReturnType<typeof useRouter>
type NextNavigateOptions = NonNullable<Parameters<NextAppRouter["push"]>[1]>

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NextNavigateOptions
  }
}

/**
 * Anything the Next.js App Router must not handle: `scheme:` hrefs (absolute URLs
 * from `gatewayUrl()`, `mailto:`, `tel:`) and protocol-relative `//host/path`.
 */
const EXTERNAL_HREF_PATTERN = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * Schemes we are willing to hand to `window.location.assign`. Every React Aria
 * pressable with an `href` flows through `navigate`, so an href built from stored
 * or member-supplied data must never reach `javascript:` / `data:` / `blob:`.
 */
const SAFE_EXTERNAL_HREF_PATTERN = /^(https?:|mailto:|tel:|sms:|\/\/)/i

/**
 * Bridges React Aria's `href` handling to the Next.js App Router.
 *
 * Relative hrefs use client-side navigation. External hrefs fall through to a
 * full browser navigation — required for cross-zone links (`account.` → `app.`)
 * where the gateway rewrite must run, and for non-HTTP schemes.
 */
export function AppRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const navigate = React.useCallback(
    (href: string, options?: NextNavigateOptions) => {
      if (EXTERNAL_HREF_PATTERN.test(href)) {
        if (SAFE_EXTERNAL_HREF_PATTERN.test(href)) {
          window.location.assign(href)
        } else if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[AppRouterProvider] blocked navigation to unsafe href: ${href}`
          )
        }
        return
      }
      router.push(href, options)
    },
    [router]
  )

  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}
