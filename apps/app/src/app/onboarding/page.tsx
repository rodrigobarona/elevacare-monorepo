import { redirect } from "next/navigation"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { checkExistingMembership } from "./actions"
import { OnboardingForm } from "./onboarding-form"

export const dynamic = "force-dynamic"

/**
 * Workspace onboarding page. Shown to users who are authenticated
 * via WorkOS but don't yet have an organization/membership in the DB.
 *
 * Flow:
 * 1. Check if user was invited to an existing org → auto-provision + redirect
 * 2. Otherwise show workspace creation form
 */
export default async function OnboardingPage() {
  const { user } = await withAuth({ ensureSignedIn: true })

  const { hasMembership } = await checkExistingMembership()
  if (hasMembership) {
    redirect("/auth-redirect")
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Eleva
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Let&apos;s set up your workspace, {displayName}.
          </p>
        </header>

        <OnboardingForm defaultName={`${displayName}'s Workspace`} />
      </div>
    </div>
  )
}
