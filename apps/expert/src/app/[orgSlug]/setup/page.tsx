import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSessionForOrg } from "@eleva/auth"
import { ensureExpertProfileForOrg, getExpertProfileForOrg } from "@eleva/db"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
import { expertWorkspaceBase, expertWorkspacePath } from "@/lib/workspace-paths"
import { redirectToMemberOrg } from "@/lib/gateway-redirects"
import { OnboardingWizard } from "./onboarding-wizard"

export const dynamic = "force-dynamic"

const STEPS = [
  "profile",
  "connect",
  "identity",
  "invoicing",
  "schedule",
] as const

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

  let profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  if (!profile) {
    profile = await ensureExpertProfileForOrg({
      userId: session.user.id,
      orgId: session.orgId,
      orgSlug,
      displayName: session.user.displayName ?? session.user.email,
    })
  }

  if (!requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session))
  }

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const completed: string[] = Array.isArray(completedSteps)
    ? completedSteps
    : []

  const currentStepIndex = STEPS.findIndex((s) => !completed.includes(s))
  const currentStep =
    currentStepIndex === -1 ? STEPS[STEPS.length - 1] : STEPS[currentStepIndex]

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
        steps={STEPS as unknown as string[]}
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
