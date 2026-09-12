"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { StepProfile } from "./step-profile"
import { StepConnect } from "./step-connect"
import { StepIdentity } from "./step-identity"
import { StepInvoicing } from "./step-invoicing"
import { StepSchedule } from "./step-schedule"
import type { StripeIdentityStatus, InvoicingSetupStatus } from "@eleva/db"

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
  stripeIdentityStatus: StripeIdentityStatus
  requirementsCurrentlyDue: string[]
  invoicingProvider: string | null
  invoicingSetupStatus: InvoicingSetupStatus
}

interface Props {
  orgSlug: string
  steps: string[]
  completedSteps: string[]
  currentStep: string
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
  workspaceBase: string
  identityEnabled: boolean
}

export function OnboardingWizard({
  orgSlug: _orgSlug,
  steps,
  completedSteps,
  currentStep: initialStep,
  profile,
  apiBaseUrl,
  stripePublishableKey,
  workspaceBase,
  identityEnabled,
}: Props) {
  const router = useRouter()
  const t = useTranslations("onboarding")
  const [activeStep, setActiveStep] = React.useState(initialStep)
  const stepLabel = t(`steps.${activeStep}` as "steps.profile")

  function handleStepDone() {
    const idx = steps.indexOf(activeStep)
    if (idx < steps.length - 1) {
      setActiveStep(steps[idx + 1]!)
    }
    router.refresh()
  }

  const showNext =
    completedSteps.includes(activeStep) &&
    steps.indexOf(activeStep) < steps.length - 1

  return (
    <div className="space-y-6">
      <nav aria-label="Onboarding steps" className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const done = completedSteps.includes(step)
          const isActive = step === activeStep
          const label = t(`steps.${step}` as "steps.profile")
          return (
            <button
              key={step}
              type="button"
              onClick={() => setActiveStep(step)}
              aria-label={`Step ${i + 1}: ${label}${done ? " (complete)" : ""}`}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-eleva-primary bg-eleva-primary text-white"
                  : done
                    ? "border-eleva-primary-light/50 bg-eleva-primary-light/10 text-eleva-primary"
                    : "border-border text-muted-foreground"
              }`}
            >
              <span className="font-mono tabular-nums">{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
              {done && <span aria-hidden="true">&#10003;</span>}
            </button>
          )
        })}
      </nav>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{stepLabel}</SettingsFieldsetTitle>
          <div className="mt-4">
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
            {activeStep === "identity" && identityEnabled && (
              <StepIdentity
                profile={profile}
                apiBaseUrl={apiBaseUrl}
                onDone={handleStepDone}
              />
            )}
            {activeStep === "invoicing" && (
              <StepInvoicing
                profile={profile}
                onDone={handleStepDone}
                workspaceBase={workspaceBase}
              />
            )}
            {activeStep === "schedule" && (
              <StepSchedule onDone={handleStepDone} />
            )}
          </div>
        </SettingsFieldsetContent>
        {showNext && (
          <SettingsFieldsetFooter>
            <SettingsFieldsetActions className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleStepDone}>
                Next step &rarr;
              </Button>
            </SettingsFieldsetActions>
          </SettingsFieldsetFooter>
        )}
      </SettingsFieldset>
    </div>
  )
}
