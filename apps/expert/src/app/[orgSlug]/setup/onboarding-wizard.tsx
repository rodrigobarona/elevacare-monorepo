"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { PageHeader } from "@eleva/ui/components/page-header"
import { Progress } from "@eleva/ui/components/progress"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { StepProfile } from "./step-profile"
import { StepPractice } from "./step-practice"
import { StepConnect } from "./step-connect"
import { StepIdentity } from "./step-identity"
import { StepInvoicing } from "./step-invoicing"
import { StepFinish } from "./step-finish"
import { SetupProgressNav } from "./setup-progress-nav"
import type { StripeIdentityStatus, InvoicingSetupStatus } from "@eleva/db"

export interface OnboardingProfile {
  id: string
  orgId: string
  nif: string | null
  licenseScope: string | null
  languages: string[]
  practiceCountry: string
  serviceCountries: string[]
  practiceCountries: string[]
  worldwideMode: boolean
  worldwideRemote: boolean
  sessionModes: string[]
  stripeAccountId: string | null
  stripeIdentityStatus: StripeIdentityStatus
  requirementsCurrentlyDue: string[]
  invoicingProvider: string | null
  invoicingSetupStatus: InvoicingSetupStatus
}

interface Props {
  steps: string[]
  completedSteps: string[]
  currentStep: string
  profile: OnboardingProfile
  apiBaseUrl: string
  stripePublishableKey: string
  workspaceBase: string
  identityEnabled: boolean
  invoicingError?: string
  toconlineEnabled: boolean
}

export function OnboardingWizard({
  steps,
  completedSteps,
  currentStep: initialStep,
  profile,
  apiBaseUrl,
  stripePublishableKey,
  workspaceBase,
  identityEnabled,
  invoicingError,
  toconlineEnabled,
}: Props) {
  const router = useRouter()
  const t = useTranslations("onboarding")
  const [activeStep, setActiveStep] = React.useState(initialStep)
  const activeIndex = steps.indexOf(activeStep)
  const stepLabel = t(`steps.${activeStep}` as "steps.profile")
  const stepHint = t(`stepHints.${activeStep}` as "stepHints.profile")

  function handleStepDone() {
    if (activeIndex < steps.length - 1) {
      setActiveStep(steps[activeIndex + 1]!)
    }
    router.refresh()
  }

  const showNext =
    completedSteps.includes(activeStep) && activeIndex < steps.length - 1
  const doneCount = steps.filter((step) => completedSteps.includes(step)).length
  const progressText = t("progress.value", {
    done: doneCount,
    total: steps.length,
  })

  const stepBody = (
    <>
      {activeStep === "profile" && (
        <StepProfile profile={profile} onDone={handleStepDone} />
      )}
      {activeStep === "practice" && (
        <StepPractice
          profile={{
            practiceCountry: profile.practiceCountry,
            serviceCountries:
              profile.serviceCountries.length > 0
                ? profile.serviceCountries
                : profile.practiceCountries,
            languages: profile.languages,
            licenseScope: profile.licenseScope,
            worldwideRemote: profile.worldwideRemote,
          }}
          onDone={handleStepDone}
        />
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
          stripePublishableKey={stripePublishableKey}
          onDone={handleStepDone}
        />
      )}
      {activeStep === "invoicing" && (
        <StepInvoicing
          profile={profile}
          onDone={handleStepDone}
          invoicingError={invoicingError}
          toconlineEnabled={toconlineEnabled}
        />
      )}
      {activeStep === "schedule" && (
        <StepFinish workspaceBase={workspaceBase} />
      )}
    </>
  )

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
        <PageHeader
          className="mb-0"
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-1">
          <Progress
            value={doneCount}
            maxValue={steps.length}
            valueLabel={progressText}
            aria-label={t("progress.label")}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {progressText}
          </p>
        </div>

        <SetupProgressNav
          steps={steps}
          completedSteps={completedSteps}
          activeStep={activeStep}
          onSelectStep={setActiveStep}
          stepLabel={(step) => t(`steps.${step}` as "steps.profile")}
          ariaLabel={t("progress.nav")}
          stepAriaLabel={({ index, done, label }) =>
            t(done ? "progress.stepDone" : "progress.step", {
              number: index + 1,
              label,
            })
          }
        />
      </aside>

      <SettingsFieldset
        key={activeStep}
        aria-labelledby="setup-step-title"
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
      >
        <SettingsFieldsetContent className="space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {t("progress.stepOf", {
                number: activeIndex + 1,
                total: steps.length,
              })}
            </p>
            <SettingsFieldsetTitle as="h2" id="setup-step-title">
              {stepLabel}
            </SettingsFieldsetTitle>
            <SettingsFieldsetDescription>
              {stepHint}
            </SettingsFieldsetDescription>
          </div>
          {stepBody}
        </SettingsFieldsetContent>

        {showNext ? (
          <SettingsFieldsetFooter>
            <SettingsFieldsetActions className="ms-auto w-full justify-end sm:w-auto">
              <Button variant="outline" onPress={handleStepDone}>
                {t("progress.next")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </SettingsFieldsetActions>
          </SettingsFieldsetFooter>
        ) : null}
      </SettingsFieldset>
    </div>
  )
}
