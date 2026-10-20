"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightIcon, CheckIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Progress } from "@eleva/ui/components/progress"
import { cn } from "@eleva/ui/lib/utils"
import { StepProfile } from "./step-profile"
import { StepPractice } from "./step-practice"
import { StepConnect } from "./step-connect"
import { StepIdentity } from "./step-identity"
import { StepInvoicing } from "./step-invoicing"
import { StepFinish } from "./step-finish"
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

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading text-3xl text-balance">{t("title")}</h1>
          <p className="text-sm text-pretty text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
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

        <nav aria-label={t("progress.nav")}>
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {steps.map((step, i) => {
              const done = completedSteps.includes(step)
              const isActive = step === activeStep
              const label = t(`steps.${step}` as "steps.profile")
              return (
                <li key={step} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveStep(step)}
                    aria-label={t(
                      done ? "progress.stepDone" : "progress.step",
                      {
                        number: i + 1,
                        label,
                      }
                    )}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 transition-colors",
                        done
                          ? "bg-primary text-primary-foreground ring-primary"
                          : isActive
                            ? "bg-background text-primary ring-2 ring-primary"
                            : "bg-background ring-border"
                      )}
                    >
                      {done ? (
                        <CheckIcon weight="bold" className="size-3.5" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="hidden whitespace-nowrap sm:inline lg:whitespace-normal">
                      {label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </aside>

      <section
        key={activeStep}
        aria-labelledby="setup-step-title"
        className="rounded-3xl border bg-card p-6 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:p-8"
      >
        <header className="mb-6 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground tabular-nums">
            {t("progress.stepOf", {
              number: activeIndex + 1,
              total: steps.length,
            })}
          </p>
          <h2 id="setup-step-title" className="font-heading text-2xl">
            {stepLabel}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {t(`stepHints.${activeStep}` as "stepHints.profile")}
          </p>
        </header>

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

        {showNext && (
          <div className="mt-8 flex justify-end border-t pt-6">
            <Button variant="outline" onPress={handleStepDone}>
              {t("progress.next")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
