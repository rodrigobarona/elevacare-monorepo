import { redirect } from "next/navigation"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getTranslations } from "next-intl/server"
import { checkExistingMembership } from "./actions"
import { OnboardingForm } from "./onboarding-form"

export const dynamic = "force-dynamic"

/**
 * Space onboarding page. Shown to users who are authenticated
 * via WorkOS but don't yet have an organization/membership in the DB.
 */
export default async function OnboardingPage() {
  const { user } = await withAuth({ ensureSignedIn: true })

  const { hasMembership } = await checkExistingMembership()
  if (hasMembership) {
    redirect("/dashboard")
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  const firstName = user.firstName || user.email

  const t = await getTranslations("onboarding")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("subtitle", { name: displayName })}
          </p>
        </header>

        <OnboardingForm defaultName={t("defaultName", { name: firstName })} />
      </div>
    </div>
  )
}
