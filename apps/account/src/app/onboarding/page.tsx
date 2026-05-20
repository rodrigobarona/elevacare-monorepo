import { redirect } from "next/navigation"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getLocale, getTranslations } from "next-intl/server"
import { normalizeLocale } from "@eleva/config/i18n"
import { checkExistingMembership } from "./actions"
import { OnboardingForm } from "./onboarding-form"

export const dynamic = "force-dynamic"

/**
 * Space onboarding page. Shown to users who are authenticated
 * via WorkOS but don't yet have an organization/membership in the DB.
 */
export default async function OnboardingPage() {
  const { user } = await withAuth({ ensureSignedIn: true })
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
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="font-serif text-3xl tracking-tight text-eleva-primary">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-eleva-neutral-900/70">
            {t("subtitle", { name: displayName })}
          </p>
        </header>

        <OnboardingForm
          defaultName={t("defaultName", { name: firstName })}
          apiBaseUrl={apiBaseUrl}
          locale={locale}
        />
      </div>
    </div>
  )
}
