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
import {
  DecisionRestoredNotice,
  DecisionSignInRefusal,
  useDecisionSignIn,
} from "@/components/decision-sign-in"
import { decideLicence, type DecideLicenceError } from "./actions"

interface Props {
  expertProfileId: string
  applicationId: string
  submittedAt: string
}

type Decision = LicenceDecisionRequest["decision"]

const REASON_MAX_LENGTH = 1000

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
  // The refusal is shown beside the button that was pressed.
  const [error, setError] = React.useState<{
    decision: Decision
    code: DecideLicenceError
  } | null>(null)

  const allChecked = LICENCE_CHECKLIST_ITEMS.every((item) => checked[item])
  const hasReason = reason.trim().length > 0

  // What is on the form survives signing in again, and comes back once.
  const signIn = useDecisionSignIn({
    version: submittedAt,
    items: LICENCE_CHECKLIST_ITEMS,
    maxText: REASON_MAX_LENGTH,
    read: () => ({
      ticks: LICENCE_CHECKLIST_ITEMS.filter((item) => checked[item]),
      text: reason,
    }),
    restore: ({ ticks, text }) => {
      setChecked(Object.fromEntries(ticks.map((item) => [item, true])))
      setReason(text)
    },
  })

  async function decide(decision: Decision) {
    setError(null)
    // A sign-in the page already knows is too old is answered here: the
    // API would refuse it, and an old session that tries to decide is a
    // line in its log worth keeping for the ones nobody expected.
    if (signIn.expired) {
      setError({ decision, code: "step-up" })
      return
    }
    setPending(decision)
    const target = { applicationId, submittedAt }
    // A request that never reaches the server must not lock the form.
    const result = await decideLicence(
      expertProfileId,
      decision === "approve"
        ? { ...target, decision, checklist: checked }
        : { ...target, decision, reason: reason.trim() }
    )
      .catch(() => ({ ok: false as const, error: "failed" as const }))
      .finally(() => setPending(null))
    if (!result.ok) {
      setError({ decision, code: result.error })
      return
    }
    signIn.forget()
    toast.success(t(`toasts.${decision}`))
    router.refresh()
  }

  function refusal(shown: boolean) {
    if (!error || !shown) return null
    // Signing in again is a routine step, not something that went wrong.
    if (error.code === "step-up") return <DecisionSignInRefusal />
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription data-testid="licence-decision-error">
          {t(`errors.${error.code}`)}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <DecisionRestoredNotice returned={signIn.returned} hasText={hasReason} />
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
        {refusal(error?.decision === "approve")}
        <Button
          isDisabled={!allChecked || pending !== null}
          isPending={pending === "approve"}
          onPress={() => decide("approve")}
          data-testid="licence-approve"
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
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            aria-describedby="licence-decision-reason-help"
            data-testid="licence-decision-reason"
            onChange={(event) => setReason(event.target.value)}
          />
          <p
            id="licence-decision-reason-help"
            className="text-sm text-muted-foreground"
          >
            {t("reasonHelp")}
          </p>
        </div>
        {refusal(error !== null && error.decision !== "approve")}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={!hasReason || pending !== null}
            isPending={pending === "needs_changes"}
            onPress={() => decide("needs_changes")}
            data-testid="licence-needs-changes"
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
