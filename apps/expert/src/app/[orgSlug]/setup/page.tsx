import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSessionForOrg } from "@eleva/auth"
import { getConnectOnboardingState } from "@eleva/billing/server"
import { getFlag } from "@eleva/flags"
import { requiresExpertOnboarding } from "@/lib/expert-profile-guards"
import { resolveOrCreateExpertProfileForSession } from "@/lib/resolve-expert-profile"
import { expertWorkspaceBase, expertWorkspacePath } from "@/lib/workspace-paths"
import { redirectToMemberOrg } from "@/lib/gateway-redirects"
import { OnboardingWizard } from "./onboarding-wizard"
import { ONBOARDING_STEPS } from "./onboarding-steps"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{
    invoicing_error?: string
    invoicing_connected?: string
  }>
}) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams])
  const session = await guardSessionForOrg(orgSlug)
  if (!session.capabilities.includes("expert:onboard")) {
    redirectToMemberOrg(orgSlug)
  }

  const profile = await resolveOrCreateExpertProfileForSession(session, orgSlug)

  if (!requiresExpertOnboarding(profile)) {
    redirect(expertWorkspacePath(session))
  }

  const [identityEnabled, expertInvoicingEnabled, toconlineInvoicingEnabled] =
    await Promise.all([
      getFlag("ff.expert_identity_verification"),
      getFlag("ff.expert_invoicing_apps_enabled"),
      getFlag("ff.invoicing.toconline"),
    ])
  const toconlineEnabled = Boolean(
    expertInvoicingEnabled && toconlineInvoicingEnabled
  )
  const connectState = await getConnectOnboardingState(profile.orgId)

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const completed: string[] = Array.isArray(completedSteps)
    ? completedSteps
    : []

  const wizardSteps = identityEnabled
    ? ONBOARDING_STEPS
    : ONBOARDING_STEPS.filter((step) => step !== "identity")

  const currentStepIndex = wizardSteps.findIndex((s) => !completed.includes(s))
  const invoicingCallback =
    Boolean(query.invoicing_error) || query.invoicing_connected === "true"
  const currentStep = invoicingCallback
    ? "invoicing"
    : currentStepIndex === -1
      ? wizardSteps[wizardSteps.length - 1]
      : wizardSteps[currentStepIndex]

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
        steps={wizardSteps as unknown as string[]}
        completedSteps={completed}
        currentStep={currentStep!}
        invoicingError={query.invoicing_error}
        identityEnabled={identityEnabled}
        toconlineEnabled={toconlineEnabled}
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
          requirementsCurrentlyDue:
            connectState?.requirementsCurrentlyDue ?? [],
          invoicingProvider: profile.invoicingProvider,
          invoicingSetupStatus: profile.invoicingSetupStatus,
        }}
        apiBaseUrl={apiBaseUrl}
        stripePublishableKey={stripePublishableKey}
      />
    </div>
  )
}
