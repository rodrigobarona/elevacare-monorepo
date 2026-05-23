"use client"

import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { cn } from "@eleva/ui/lib/utils"
import type {
  ExpertDraft,
  PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"
import { COUNTRY_LABELS } from "@/domains/expert-onboarding/lib/types"

interface CountryComplianceGateProps {
  draft: ExpertDraft
  onChange: (patch: Partial<ExpertDraft>) => void
  className?: string
}

export function CountryComplianceGate({
  draft,
  onChange,
  className,
}: CountryComplianceGateProps) {
  const country = draft.practiceCountry

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          Local requirements — {COUNTRY_LABELS[country]}
        </p>
        <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
          These details stay private until you request to go live. Eleva may
          verify credentials for platform compliance.
        </p>
      </div>

      <CountryFields
        country={country}
        nif={draft.nif}
        licenseScope={draft.licenseScope}
        onNif={(nif) => onChange({ nif })}
        onLicense={(licenseScope) => onChange({ licenseScope })}
      />

      <ComplianceQuestions
        ack={draft.complianceAck}
        terms={draft.termsAccepted}
        onAck={(complianceAck) => onChange({ complianceAck })}
        onTerms={(termsAccepted) => onChange({ termsAccepted })}
      />
    </div>
  )
}

function CountryFields({
  country,
  nif,
  licenseScope,
  onNif,
  onLicense,
}: {
  country: PracticeCountry
  nif: string
  licenseScope: string
  onNif: (v: string) => void
  onLicense: (v: string) => void
}) {
  const labels = {
    PT: { tax: "NIF", license: "Professional license (e.g. OPP 12345)" },
    ES: { tax: "NIF / IVA", license: "Colegio registration number" },
    BR: { tax: "CPF / CNPJ", license: "Conselho profissional registration" },
  }[country]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="tax-id">{labels.tax}</Label>
        <Input
          id="tax-id"
          value={nif}
          onChange={(e) => onNif(e.target.value)}
          placeholder={country === "PT" ? "123456789" : ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="license">{labels.license}</Label>
        <Input
          id="license"
          value={licenseScope}
          onChange={(e) => onLicense(e.target.value)}
        />
      </div>
      {country === "PT" ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Invoicing via TOConline will be connected after identity verification.
          ERS-aligned telehealth self-certification required for clinical
          sessions.
        </p>
      ) : null}
    </div>
  )
}

function ComplianceQuestions({
  ack,
  terms,
  onAck,
  onTerms,
}: {
  ack: boolean
  terms: boolean
  onAck: (v: boolean) => void
  onTerms: (v: boolean) => void
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/60 p-4">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={ack}
          onCheckedChange={(v) => onAck(v === true)}
          className="mt-0.5"
        />
        <span>
          I hold valid professional registration and professional liability
          coverage for my practice area, and I deliver care independently —
          Eleva provides the platform only.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={terms}
          onCheckedChange={(v) => onTerms(v === true)}
          className="mt-0.5"
        />
        <span>
          I agree to the Expert Terms, privacy policy, and understand my profile
          will be reviewed before going live.
        </span>
      </label>
    </div>
  )
}
