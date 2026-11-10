import { getAuthUser } from "@eleva/auth/server"
import { captureException } from "@eleva/observability"
import { getLocale, getTranslations } from "next-intl/server"
import { AccountMenu } from "@eleva/dashboard/account-menu"
import {
  accountMenuFor,
  loadUserWorkspaces,
} from "@eleva/dashboard/account-menu-server"
import { localePath } from "@/lib/hreflang"
import { SignedOutButtons } from "./signed-out-buttons"

/**
 * Async auth slot for the marketing header. Rendered inside a Suspense
 * boundary; SiteHeader picks the fallback from the session cookie so
 * logged-in visitors never flash signed-out buttons while this resolves.
 */
export async function SiteHeaderAuthSlot() {
  const [t, locale] = await Promise.all([getTranslations("nav"), getLocale()])

  let user: Awaited<ReturnType<typeof getAuthUser>> = null
  try {
    user = await getAuthUser()
  } catch (err) {
    // getAuthUser returns null for unauthenticated visitors; a thrown
    // error is unexpected and should be reported.
    captureException(err, { component: "SiteHeaderAuthSlot" })
  }

  if (!user) {
    return (
      <SignedOutButtons
        loginLabel={t("login")}
        findExpertLabel={t("findExpert")}
        findExpertHref={localePath(locale, "/experts")}
      />
    )
  }

  // The public site has no active workspace, so every workspace is a
  // shortcut and Help opens the help centre's front page.
  // A failed lookup must not take down the public header: show the menu
  // without workspace rows and report it.
  const workspaces = await loadUserWorkspaces(user.id, null).catch((err) => {
    captureException(err, { component: "SiteHeaderAuthSlot" })
    return []
  })

  return (
    <AccountMenu
      surface="site"
      user={{
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
      menu={accountMenuFor(workspaces)}
    />
  )
}
