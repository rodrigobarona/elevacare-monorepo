import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { LOGIN_PATH } from "@eleva/auth"
import { getAuthUser } from "@eleva/auth/server"
import { normalizeLocale } from "@eleva/config/i18n"
import { checkExistingMembership } from "./actions"
import { AuthHeading } from "@/components/auth-ui"
import { OnboardingForm } from "./onboarding-form"

export const dynamic = "force-dynamic"

/**
 * Space onboarding page. Shown to users who are authenticated
 * but don't yet have an organization/membership in the DB.
 */
export default async function OnboardingPage() {
  // Signed in is enough here: the people this page is for have no
  // membership yet, which is exactly when getSession() returns null.
  const user = await getAuthUser()
  if (!user) {
    redirect(LOGIN_PATH)
  }
  const locale = normalizeLocale(await getLocale()) ?? "en"

  const { hasMembership } = await checkExistingMembership(locale)
  if (hasMembership) {
    redirect("/dashboard")
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  const firstName = user.firstName || user.email

  const t = await getTranslations("onboarding")
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <AuthHeading
          title={t("title")}
          description={t("subtitle", { name: displayName })}
        />

        <OnboardingForm
          defaultName={t("defaultName", { name: firstName })}
          apiBaseUrl={apiBaseUrl}
          locale={locale}
        />
      </div>
    </div>
  )
}
