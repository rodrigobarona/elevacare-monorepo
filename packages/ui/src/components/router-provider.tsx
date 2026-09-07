"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RouterProvider } from "react-aria-components"

import { classifyHref } from "@eleva/ui/lib/href"

type NextAppRouter = ReturnType<typeof useRouter>
type NextNavigateOptions = NonNullable<Parameters<NextAppRouter["push"]>[1]>

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NextNavigateOptions
  }
}

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
    (rawHref: string, options?: NextNavigateOptions) => {
      const target = classifyHref(rawHref)
      switch (target.kind) {
        case "internal":
          router.push(target.href, options)
          return
        case "external":
          window.location.assign(target.href)
          return
        case "blocked":
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `[AppRouterProvider] blocked navigation to unsafe href: ${target.href}`
            )
          }
          return
        default: {
          const exhaustive: never = target
          return exhaustive
        }
      }
    },
    [router]
  )

  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}
