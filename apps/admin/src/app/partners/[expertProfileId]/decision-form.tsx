"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { LicenceDecisionRequest } from "@eleva/api-client"
import {
  LICENCE_CHECKLIST_ITEMS,
  type LicenceChecklistItem,
} from "@eleva/config/professional-bodies"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import { decideLicence, type DecideLicenceError } from "./actions"

interface Props {
  expertProfileId: string
  applicationId: string
  submittedAt: string
}

type Decision = LicenceDecisionRequest["decision"]

export function DecisionForm({
  expertProfileId,
  applicationId,
  submittedAt,
}: Props) {
  const t = useTranslations("partners.detail")
  const router = useRouter()
  const [checked, setChecked] = React.useState<
    Partial<Record<LicenceChecklistItem, boolean>>
  >({})
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<Decision | null>(null)
  const [error, setError] = React.useState<DecideLicenceError | null>(null)

  const allChecked = LICENCE_CHECKLIST_ITEMS.every((item) => checked[item])
  const hasReason = reason.trim().length > 0

  async function decide(decision: Decision) {
    setPending(decision)
    setError(null)
    const target = { applicationId, submittedAt }
    const result = await decideLicence(
      expertProfileId,
      decision === "approve"
        ? { ...target, decision, checklist: checked }
        : { ...target, decision, reason: reason.trim() }
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
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("checklistHelp")}</p>
        {LICENCE_CHECKLIST_ITEMS.map((item) => (
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
        >
          {pending === "approve" ? t("approving") : t("approve")}
        </Button>
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="licence-decision-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="licence-decision-reason"
            value={reason}
            maxLength={1000}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t("reasonHelp")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={!hasReason || pending !== null}
            isPending={pending === "needs_changes"}
            onPress={() => decide("needs_changes")}
          >
            {pending === "needs_changes" ? t("saving") : t("needsChanges")}
          </Button>
          <Button
            variant="destructive"
            isDisabled={!hasReason || pending !== null}
            isPending={pending === "reject"}
            onPress={() => decide("reject")}
          >
            {pending === "reject" ? t("saving") : t("reject")}
          </Button>
        </div>
      </div>
    </div>
  )
}
