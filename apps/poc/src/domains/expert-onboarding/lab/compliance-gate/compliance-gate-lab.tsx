"use client"

import { useCallback, useState } from "react"
import { SetupSpaceGate } from "@/domains/expert-onboarding/lab/shared/setup-space-gate"
import { SetupLabShell } from "@/domains/expert-onboarding/lab/shared/setup-lab-shell"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"
import { CountryComplianceGate } from "@/domains/expert-onboarding/components/shared/country-compliance-gate"
import { createDefaultDraft } from "@/domains/expert-onboarding/lib/types"

const SLUG = "compliance-gate"

function ComplianceGateContent() {
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))
  const expert = {
    ...createDefaultDraft(),
    practiceCountry: draft.practiceCountry ?? "PT",
    nif: draft.nif ?? "",
    licenseScope: draft.licenseScope ?? "",
    complianceAck: draft.complianceDone ?? false,
    termsAccepted: draft.termsAccepted ?? false,
  }

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  return (
    <SetupLabShell draft={draft} labLabel="S5 · Compliance gate">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Final compliance gate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Required before publish — stays private until go-live review.
        </p>
        <CountryComplianceGate
          draft={expert}
          onChange={(patch) =>
            update({
              nif: patch.nif,
              licenseScope: patch.licenseScope,
              complianceDone: patch.complianceAck,
              termsAccepted: patch.termsAccepted,
            })
          }
          className="mt-8"
        />
        {draft.complianceDone && draft.termsAccepted ? (
          <p className="mt-6 text-sm font-medium text-emerald-700">
            Compliance complete (mock)
          </p>
        ) : null}
      </div>
    </SetupLabShell>
  )
}

export function ComplianceGateLab() {
  return (
    <SetupSpaceGate slug={SLUG}>
      <ComplianceGateContent />
    </SetupSpaceGate>
  )
}
