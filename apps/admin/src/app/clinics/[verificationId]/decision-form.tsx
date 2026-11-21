"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { ClinicDecisionRequest } from "@eleva/api-client"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import { decideClinic, type DecideClinicError } from "./actions"

const CHECKS = ["legal_entity_checked", "tax_id_checked"] as const
type Check = (typeof CHECKS)[number]
type Decision = ClinicDecisionRequest["decision"]

export function DecisionForm({
  verificationId,
  submittedAt,
}: {
  verificationId: string
  submittedAt: string
}) {
  const t = useTranslations("clinics.detail")
  const router = useRouter()
  const [checked, setChecked] = React.useState<Partial<Record<Check, boolean>>>(
    {}
  )
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<Decision | null>(null)
  const [error, setError] = React.useState<DecideClinicError | null>(null)

  const allChecked = CHECKS.every((item) => checked[item])
  const hasReason = reason.trim().length > 0

  async function decide(decision: Decision) {
    setPending(decision)
    setError(null)
    const result = await decideClinic(
      verificationId,
      decision === "approve"
        ? { submittedAt, decision, checklist: checked }
        : { submittedAt, decision, reason: reason.trim() }
    )
    setPending(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t(`toasts.${decision}`))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("checklistHelp")}</p>
        {CHECKS.map((item) => (
          <CheckboxField
            key={item}
            label={t(`checklist.${item}`)}
            isSelected={checked[item] === true}
            onChange={(isSelected) =>
              setChecked((current) => ({ ...current, [item]: isSelected }))
            }
          />
        ))}
        <Button
          isDisabled={!allChecked || pending !== null}
          isPending={pending === "approve"}
          onPress={() => decide("approve")}
          data-testid="clinic-approve"
        >
          {pending === "approve" ? t("approving") : t("approve")}
        </Button>
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="clinic-decision-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="clinic-decision-reason"
            value={reason}
            maxLength={1000}
            rows={3}
            aria-describedby="clinic-decision-reason-help"
            onChange={(event) => setReason(event.target.value)}
          />
          <p
            id="clinic-decision-reason-help"
            className="text-sm text-muted-foreground"
          >
            {t("reasonHelp")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={!hasReason || pending !== null}
            isPending={pending === "needs_changes"}
            onPress={() => decide("needs_changes")}
            data-testid="clinic-needs-changes"
          >
            {pending === "needs_changes" ? t("saving") : t("needsChanges")}
          </Button>
          <Button
            variant="destructive"
            isDisabled={!hasReason || pending !== null}
            isPending={pending === "reject"}
            onPress={() => decide("reject")}
            data-testid="clinic-reject"
          >
            {pending === "reject" ? t("saving") : t("reject")}
          </Button>
        </div>
      </div>
    </div>
  )
}
