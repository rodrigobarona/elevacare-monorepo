import { getAuthUser } from "@eleva/auth/server"
import { getTranslations } from "next-intl/server"
import { UserMenu } from "./user-menu"
import { SignedOutButtons } from "./signed-out-buttons"

/**
 * Async auth slot for the marketing header. Rendered inside a Suspense
 * boundary so the rest of the page (and the signin/signup buttons in
 * the fallback) become interactive without waiting on the WorkOS
 * cookie decryption + iron-session unseal performed by `getAuthUser()`.
 *
 * - Logged-out: returns the same SignedOutButtons used in the fallback,
 *   so visually nothing changes after the slot resolves.
 * - Logged-in:  returns the UserMenu, replacing the buttons.
 */
export async function SiteHeaderAuthSlot() {
  const t = await getTranslations("nav")

  let user: {
    firstName: string | null
    lastName: string | null
    email: string
  } | null = null
  try {
    user = await getAuthUser()
  } catch {
    // Not authenticated -- silently fall through to logged-out state.
    // Expected when no WorkOS cookie is present.
  }

  if (!user) {
    return (
      <SignedOutButtons signInLabel={t("signin")} signUpLabel={t("signup")} />
    )
  }

  const initials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    "?"

  return (
    <UserMenu
      initials={initials}
      firstName={user.firstName}
      email={user.email}
      dashboardLabel={t("dashboard")}
      signOutLabel={t("signout")}
      dashboardUrl="/dashboard"
      signOutUrl="/logout"
    />
  )
}
