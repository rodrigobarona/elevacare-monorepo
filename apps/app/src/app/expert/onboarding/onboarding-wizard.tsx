"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Button } from "@eleva/ui/components/button"
import { StepProfile } from "./step-profile"
import { StepConnect } from "./step-connect"
import { StepIdentity } from "./step-identity"
import { StepInvoicing } from "./step-invoicing"
import { StepSchedule } from "./step-schedule"

const STEP_LABELS: Record<string, string> = {
  profile: "Profile & Fiscal Info",
  connect: "Stripe Connect",
  identity: "Identity Verification",
  invoicing: "Invoicing Setup",
  schedule: "First Event Type",
}

export interface OnboardingProfile {
  id: string
  orgId: string
  nif: string | null
  licenseScope: string | null
  languages: string[]
  practiceCountries: string[]
  worldwideMode: boolean
  sessionModes: string[]
  stripeAccountId: string | null
  stripeIdentityStatus: string
  invoicingProvider: string | null
  invoicingSetupStatus: string
}

interface Props {
  steps: string[]
  completedSteps: string[]
  currentStep: string
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
}

export function OnboardingWizard({
  steps,
  completedSteps,
  currentStep: initialStep,
  profile,
  apiBaseUrl,
  stripePublishableKey,
}: Props) {
  const router = useRouter()
  const [activeStep, setActiveStep] = React.useState(initialStep)

  function handleStepDone() {
    const idx = steps.indexOf(activeStep)
    if (idx < steps.length - 1) {
      setActiveStep(steps[idx + 1]!)
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Stepper indicator */}
      <nav className="flex gap-2">
        {steps.map((step, i) => {
          const done = completedSteps.includes(step)
          const isActive = step === activeStep
          const label = STEP_LABELS[step] ?? step
          return (
            <button
              key={step}
              type="button"
              onClick={() => setActiveStep(step)}
              aria-label={`Step ${i + 1}: ${label}${done ? " (complete)" : ""}`}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : done
                    ? "border-green-500/30 bg-green-50 text-green-700 dark:bg-green-950/20"
                    : "border-muted text-muted-foreground"
              }`}
            >
              <span className="tabular-nums">{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
              {done && <span aria-hidden="true">&#10003;</span>}
            </button>
          )
        })}
      </nav>

      {/* Active step content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEP_LABELS[activeStep] ?? activeStep}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeStep === "profile" && (
            <StepProfile profile={profile} onDone={handleStepDone} />
          )}
          {activeStep === "connect" && (
            <StepConnect
              profile={profile}
              apiBaseUrl={apiBaseUrl}
              stripePublishableKey={stripePublishableKey}
              onDone={handleStepDone}
            />
          )}
          {activeStep === "identity" && (
            <StepIdentity
              profile={profile}
              apiBaseUrl={apiBaseUrl}
              onDone={handleStepDone}
            />
          )}
          {activeStep === "invoicing" && (
            <StepInvoicing profile={profile} onDone={handleStepDone} />
          )}
          {activeStep === "schedule" && (
            <StepSchedule onDone={handleStepDone} />
          )}
        </CardContent>
      </Card>

      {/* Skip/advance helper */}
      {completedSteps.includes(activeStep) && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleStepDone}>
            Next step &rarr;
          </Button>
        </div>
      )}
    </div>
  )
}
