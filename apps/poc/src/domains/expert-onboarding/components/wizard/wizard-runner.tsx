"use client"

import * as React from "react"
import { toast } from "sonner"
import { CreateWorkspaceModalMock } from "@/domains/expert-onboarding/components/entry/create-workspace-modal-mock"
import { WizardShell } from "@/components/wizard/wizard-shell"
import { WizardFooter } from "@/components/wizard/wizard-footer"
import { GuidedPromptFooter } from "@/components/wizard/guided-prompt-footer"
import { WizardLayoutProvider } from "@/components/wizard/wizard-layout-context"
import { ChapterContextBar } from "@/components/wizard/chapter-context-bar"
import { StepRenderer } from "./step-renderer"
import { MemberProfilePreview } from "./member-profile-preview"
import { useExpertDraft } from "@/domains/expert-onboarding/lib/mock-state"
import {
  getChapterSidebarStates,
  getStepNavigationContext,
} from "@/lib/wizard-navigation"
import { getEventPipelineStage } from "@/domains/expert-onboarding/components/wizard/event-pipeline-bar"
import type { WizardRegistry, WizardVariant } from "@/lib/wizard-types"

const PRE_WIZARD_STEP_IDS = new Set([
  "p1-specialty",
  "p2-sub",
  "p3-country",
  "p4-city",
  "p5-intro",
  "p6-name",
])

const SESSION_CARD_STEP_PREFIXES = [
  "c-event",
  "c-duration",
  "c-format",
  "c-price",
  "c-desc",
]

function shouldShowSessionCard(stepId: string): boolean {
  return SESSION_CARD_STEP_PREFIXES.some(
    (prefix) => stepId === prefix || stepId.startsWith(prefix)
  )
}

interface WizardRunnerProps {
  pocId: string
  registry: WizardRegistry
  variant: WizardVariant
  onExit: () => void
  showEntryModal?: boolean
}

export function WizardRunner({
  pocId,
  registry,
  variant,
  onExit,
  showEntryModal = true,
}: WizardRunnerProps) {
  const { draft, updateDraft, hydrated } = useExpertDraft(pocId)
  const [modalOpen, setModalOpen] = React.useState(showEntryModal)
  const [started, setStarted] = React.useState(!showEntryModal)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [submitted, setSubmitted] = React.useState(false)

  const steps = registry.steps
  const step = steps[stepIndex]
  const progress = ((stepIndex + 1) / steps.length) * 100

  const nav = step
    ? getStepNavigationContext(step, registry.chapters, steps)
    : null

  const chapterStates = step
    ? getChapterSidebarStates(registry.chapters, steps, step, stepIndex)
    : []

  const activeChapterId =
    step?.chapterId && step.showSidebar !== false ? step.chapterId : undefined

  const mobileContextLabel = nav?.progressLabel

  const isPreWizard = step ? PRE_WIZARD_STEP_IDS.has(step.id) : false
  const preWizardSteps = steps.filter((s) => PRE_WIZARD_STEP_IDS.has(s.id))
  const preWizardIndex = step
    ? preWizardSteps.findIndex((s) => s.id === step.id) + 1
    : 0

  const setupProgress =
    variant === "sidebar" || variant === "split"
      ? {
          current: preWizardIndex,
          total: preWizardSteps.length,
          active: isPreWizard,
        }
      : undefined

  const handleNext = () => {
    if (!step) return
    if (step.kind === "dark-review") {
      setSubmitted(true)
      toast.success("Request to go live sent")
      setStepIndex((i) => Math.min(i + 1, steps.length - 1))
      return
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  const handleSkip = () => handleNext()

  if (!hydrated || !step || !nav) return null

  if (showEntryModal && !started) {
    return (
      <>
        <CreateWorkspaceModalMock
          open={modalOpen}
          onOpenChange={setModalOpen}
          onExpertContinue={() => {
            setModalOpen(false)
            setStarted(true)
          }}
        />
        {!modalOpen && !started ? (
          <div className="flex min-h-screen items-center justify-center bg-stone-50">
            <button
              type="button"
              className="text-sm text-eleva-primary underline"
              onClick={() => setModalOpen(true)}
            >
              Open workspace modal
            </button>
          </div>
        ) : null}
      </>
    )
  }

  const canNext = step.canProceed(draft)
  const isPostSubmit = step.kind === "post-submit" || submitted
  const isDashboard = step.kind === "dashboard-handoff"
  const hideFooter = isPostSubmit
  const isGuidedPrompt = variant === "dots"
  const showChapterBar =
    !nav.isChapterCover &&
    !isGuidedPrompt &&
    variant !== "event-first" &&
    variant !== "express"

  const nextLabel =
    step.kind === "dark-review"
      ? "Request to go live"
      : nav.isChapterCover
        ? step.chapterId
          ? "Start this chapter"
          : "Continue"
        : stepIndex === steps.length - 2
          ? "Finish"
          : "Continue"

  const stepContent = (
    <div
      key={step.id}
      className="animate-in duration-200 fade-in slide-in-from-right-2"
    >
      {showChapterBar ? <ChapterContextBar nav={nav} /> : null}
      <StepRenderer
        step={step}
        draft={draft}
        nav={nav}
        onChange={updateDraft}
        onSubmit={handleNext}
      />
    </div>
  )

  const footer =
    hideFooter || isDashboard ? (
      <div className="shrink-0 border-t border-border/40 px-4 py-4 sm:px-8">
        {isDashboard ? (
          <div className="mx-auto flex max-w-2xl justify-end">
            <button
              type="button"
              className="text-sm text-muted-foreground underline"
              onClick={onExit}
            >
              Save & exit
            </button>
          </div>
        ) : null}
      </div>
    ) : isGuidedPrompt ? (
      <GuidedPromptFooter
        onBack={handleBack}
        onNext={handleNext}
        canNext={canNext}
        showBack={stepIndex > 0}
        optional={step.optional}
        onSkip={step.optional ? handleSkip : undefined}
        stepIndex={stepIndex}
        stepTotal={steps.length}
        nextLabel={nextLabel}
      />
    ) : (
      <WizardFooter
        onBack={handleBack}
        onNext={handleNext}
        canNext={canNext}
        showBack={stepIndex > 0 && step.kind !== "post-submit"}
        optional={step.optional}
        onSkip={step.optional ? handleSkip : undefined}
        progressLabel={nav.progressLabel}
        progress={progress}
        isChapterCover={nav.isChapterCover}
        nextLabel={nextLabel}
      />
    )

  return (
    <WizardLayoutProvider
      variant={variant}
      draft={draft}
      showSessionCard={shouldShowSessionCard(step.id)}
    >
      <CreateWorkspaceModalMock
        open={modalOpen && !started}
        onOpenChange={setModalOpen}
        onExpertContinue={() => {
          setModalOpen(false)
          setStarted(true)
        }}
      />
      {!started ? null : (
        <WizardShell
          variant={variant}
          chapters={registry.chapters}
          chapterStates={chapterStates}
          activeChapterId={
            variant === "sidebar" || variant === "split"
              ? activeChapterId
              : undefined
          }
          mobileContextLabel={
            variant === "sidebar" || variant === "split"
              ? mobileContextLabel
              : undefined
          }
          setupProgress={setupProgress}
          isChapterCover={nav.isChapterCover}
          eventPipelineStage={
            variant === "event-first"
              ? getEventPipelineStage(step.id)
              : undefined
          }
          expressProgress={
            variant === "express"
              ? { current: stepIndex + 1, total: steps.length }
              : undefined
          }
          onSaveExit={onExit}
          footer={footer}
        >
          {variant === "split" ? (
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {stepContent}
              </div>
              {!nav.isChapterCover ? (
                <>
                  <div className="hidden w-[min(440px,38%)] shrink-0 lg:block">
                    <MemberProfilePreview
                      draft={draft}
                      highlight={step.previewKey}
                    />
                  </div>
                  <div className="border-t border-border/40 bg-stone-100/90 p-4 lg:hidden">
                    <MemberProfilePreview
                      draft={draft}
                      highlight={step.previewKey}
                      className="min-h-0 border-l-0 p-0"
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            stepContent
          )}
        </WizardShell>
      )}
    </WizardLayoutProvider>
  )
}
