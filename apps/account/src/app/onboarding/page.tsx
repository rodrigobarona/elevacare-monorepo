import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { LOGIN_PATH } from "@eleva/auth"
import { getSession } from "@eleva/auth/server"
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
  const session = await getSession()
  if (!session) {
    redirect(LOGIN_PATH)
  }
  const locale = normalizeLocale(await getLocale()) ?? "en"

  const { hasMembership } = await checkExistingMembership(locale)
  if (hasMembership) {
    redirect("/dashboard")
  }

  const displayName = session.user.displayName || session.user.email
  const firstName =
    session.user.displayName?.split(/\s+/)[0] || session.user.email

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
