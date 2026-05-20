import { getAuthUser } from "@eleva/auth/server"
import { captureException } from "@eleva/observability"
import { getTranslations } from "next-intl/server"
import { UserMenu } from "./user-menu"
import { SignedOutButtons } from "./signed-out-buttons"

/**
 * Async auth slot for the marketing header. Rendered inside a Suspense
 * boundary so the rest of the page (and the login/signup buttons in
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
    avatarUrl: string | null
  } | null = null
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
        getStartedLabel={t("getStarted")}
      />
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
      avatarUrl={user.avatarUrl}
      dashboardLabel={t("dashboard")}
      signOutLabel={t("signout")}
      dashboardUrl="/dashboard"
      signOutUrl="/logout"
    />
  )
}
