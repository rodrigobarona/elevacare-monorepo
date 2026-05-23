import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSessionForOrg } from "@eleva/auth"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
import { resolveOrCreateExpertProfileForSession } from "@/lib/resolve-expert-profile"
import { expertWorkspaceBase, expertWorkspacePath } from "@/lib/workspace-paths"
import { redirectToMemberOrg } from "@/lib/gateway-redirects"
import { OnboardingWizard } from "./onboarding-wizard"
import { ONBOARDING_STEPS } from "./onboarding-steps"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSessionForOrg(orgSlug)
  if (!session.capabilities.includes("expert:onboard")) {
    redirectToMemberOrg(orgSlug)
  }

  const profile = await resolveOrCreateExpertProfileForSession(session, orgSlug)

  if (!requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session))
  }

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const completed: string[] = Array.isArray(completedSteps)
    ? completedSteps
    : []

  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (s) => !completed.includes(s)
  )
  const currentStep =
    currentStepIndex === -1
      ? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]
      : ONBOARDING_STEPS[currentStepIndex]

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

  const t = await getTranslations("onboarding")

  const workspaceBase = expertWorkspaceBase(session)

  return (
    <div className="mx-auto max-w-2xl">
      <AccountPageHeader title={t("title")} description={t("description")} />

      <OnboardingWizard
        orgSlug={orgSlug}
        workspaceBase={workspaceBase}
        steps={ONBOARDING_STEPS as unknown as string[]}
        completedSteps={completed}
        currentStep={currentStep!}
        profile={{
          id: profile.id,
          orgId: profile.orgId,
          nif: profile.nif,
          licenseScope: profile.licenseScope,
          languages: profile.languages,
          practiceCountries: profile.practiceCountries,
          worldwideMode: profile.worldwideMode,
          sessionModes: profile.sessionModes,
          stripeAccountId: profile.stripeAccountId,
          stripeIdentityStatus: profile.stripeIdentityStatus,
          invoicingProvider: profile.invoicingProvider,
          invoicingSetupStatus: profile.invoicingSetupStatus,
        }}
        apiBaseUrl={apiBaseUrl}
        stripePublishableKey={stripePublishableKey}
      />
    </div>
  )
}
