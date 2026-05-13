import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { OnboardingWizard } from "./onboarding-wizard"

export const dynamic = "force-dynamic"

const STEPS = [
  "profile",
  "connect",
  "identity",
  "invoicing",
  "schedule",
] as const

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("expert:onboard")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/")

  if (profile.status === "active") {
    redirect("/expert")
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
    <AppShell session={session}>
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
    </AppShell>
  )
}
