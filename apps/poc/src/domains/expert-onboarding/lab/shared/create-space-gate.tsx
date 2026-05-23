"use client"

import * as React from "react"
import { CreateWorkspaceModalMock } from "@/domains/expert-onboarding/components/entry/create-workspace-modal-mock"
import { markSpaceCreated } from "@/domains/expert-onboarding/lab/shared/mock-storage"

interface CreateSpaceGateProps {
  slug: string
  onEntered?: () => void
  children: React.ReactNode
}

/** Same entry as classic PoC A–E: CreateWorkspaceModalMock until Expert Continue. */
export function CreateSpaceGate({
  slug,
  onEntered,
  children,
}: CreateSpaceGateProps) {
  const [modalOpen, setModalOpen] = React.useState(true)
  const [started, setStarted] = React.useState(false)

  const handleContinue = () => {
    markSpaceCreated(slug)
    setModalOpen(false)
    setStarted(true)
    onEntered?.()
  }

  if (!started) {
    return (
      <>
        <CreateWorkspaceModalMock
          open={modalOpen}
          onOpenChange={setModalOpen}
          onExpertContinue={handleContinue}
        />
        {!modalOpen ? (
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

  return <>{children}</>
}
