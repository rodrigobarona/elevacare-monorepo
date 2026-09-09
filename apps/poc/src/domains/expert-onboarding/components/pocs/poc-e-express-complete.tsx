"use client"

import * as React from "react"
import { ClockIcon, ListChecksIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { CreateWorkspaceModalMock } from "@/domains/expert-onboarding/components/entry/create-workspace-modal-mock"
import { WizardRunner } from "@/domains/expert-onboarding/components/wizard/wizard-runner"
import { POC_A_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-a-steps"
import { POC_E_EXPRESS_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-e-express-steps"
import type { PocComponentProps } from "@/domains/expert-onboarding/lib/meta"

type Path = "fork" | "express" | "complete"

export function PocEExpressComplete({ onExit }: PocComponentProps) {
  const [path, setPath] = React.useState<Path>("fork")
  const [modalOpen, setModalOpen] = React.useState(true)
  const [entered, setEntered] = React.useState(false)

  if (path === "complete") {
    return (
      <WizardRunner
        pocId="poc-e-complete"
        registry={POC_A_REGISTRY}
        variant="sidebar"
        onExit={() => setPath("fork")}
        showEntryModal={false}
      />
    )
  }

  if (path === "express") {
    return (
      <WizardRunner
        pocId="poc-e"
        registry={POC_E_EXPRESS_REGISTRY}
        variant="express"
        onExit={onExit}
        showEntryModal={false}
      />
    )
  }

  return (
    <>
      <CreateWorkspaceModalMock
        open={modalOpen && !entered}
        onOpenChange={setModalOpen}
        onExpertContinue={() => {
          setModalOpen(false)
          setEntered(true)
        }}
      />
      {entered ? (
        <div className="flex min-h-screen flex-col bg-stone-50">
          <header className="flex items-center justify-between border-b border-border/40 bg-background px-6 py-4">
            <span className="text-sm font-semibold">Eleva</span>
            <Button type="button" variant="outline" size="sm" onClick={onExit}>
              Save & exit
            </Button>
          </header>
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
            <h1 className="text-center text-3xl font-semibold tracking-tight">
              How much time do you have today?
            </h1>
            <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
              Same finish line — choose a quick draft or the full guided setup.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPath("express")}
                className={cn(
                  "rounded-3xl border border-border/60 bg-background p-8 text-left transition-all",
                  "hover:border-eleva-primary/40 hover:shadow-md"
                )}
              >
                <ClockIcon
                  className="size-8 text-eleva-primary"
                  weight="duotone"
                />
                <p className="mt-4 text-lg font-semibold">Express</p>
                <p className="mt-1 text-sm text-muted-foreground">~3 minutes</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Specialty, country, name — AI drafts the rest. Finish from
                  your dashboard.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPath("complete")}
                className={cn(
                  "rounded-3xl border border-border/60 bg-background p-8 text-left transition-all",
                  "hover:border-eleva-primary/40 hover:shadow-md"
                )}
              >
                <ListChecksIcon
                  className="size-8 text-eleva-primary"
                  weight="duotone"
                />
                <p className="mt-4 text-lg font-semibold">Complete</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ~15 minutes
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Full chapter walkthrough — photos, trilingual profile,
                  pricing, then compliance.
                </p>
              </button>
            </div>
          </main>
        </div>
      ) : null}
    </>
  )
}
