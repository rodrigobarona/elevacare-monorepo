import { redirect } from "next/navigation"
import { guardSession } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
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
  const session = await guardSession()
  if (!session.capabilities.includes("expert:onboard")) redirect(`/${orgSlug}`)

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect(`/${orgSlug}`)

  if (profile.status === "active") {
    redirect(`/${orgSlug}/expert`)
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

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-medium">Expert Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Complete all steps to activate your expert profile.
        </p>
      </header>

      <OnboardingWizard
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
