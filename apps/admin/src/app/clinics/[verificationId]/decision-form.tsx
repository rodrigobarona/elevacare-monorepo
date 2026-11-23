"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { ClinicDecisionRequest } from "@eleva/api-client"
import {
  CLINIC_CHECKLIST_ITEMS,
  type ClinicChecklistItem,
} from "@eleva/config/clinic-verification"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import { useDecisionSignIn } from "@/components/decision-sign-in"
import { decideClinic, type DecideClinicError } from "./actions"
import { DECIDED_KEY } from "./filing-note"

type Decision = ClinicDecisionRequest["decision"]

const REASON_MAX_LENGTH = 1000

export function DecisionForm({
  verificationId,
  submittedAt,
}: {
  verificationId: string
  submittedAt: string
}) {
  const t = useTranslations("clinics.detail")
  const router = useRouter()
  const [checked, setChecked] = React.useState<
    Partial<Record<ClinicChecklistItem, boolean>>
  >({})
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<Decision | null>(null)
  // Rejecting tells the whole clinic and cannot be taken back here: it is
  // confirmed, with the reason as the clinic will read it.
  const [confirmingReject, setConfirmingReject] = React.useState(false)
  // The refusal is shown beside the button that was pressed.
  const [error, setError] = React.useState<{
    decision: Decision
    code: DecideClinicError
  } | null>(null)

  const allChecked = CLINIC_CHECKLIST_ITEMS.every((item) => checked[item])
  const hasReason = reason.trim().length > 0

  // What is on the form survives signing in again, and comes back once.
  const signIn = useDecisionSignIn<Decision>({
    version: submittedAt,
    items: CLINIC_CHECKLIST_ITEMS,
    maxText: REASON_MAX_LENGTH,
    read: () => ({
      ticks: CLINIC_CHECKLIST_ITEMS.filter((item) => checked[item]),
      text: reason,
    }),
    restore: ({ ticks, text }) => {
      setChecked(Object.fromEntries(ticks.map((item) => [item, true])))
      setReason(text)
    },
  })

  async function decide(decision: Decision) {
    setError(null)
    signIn.clearRefusal()
    // A sign-in the page already knows is too old is answered here,
    // without asking the API for a refusal it is sure to give.
    if (signIn.expired) {
      signIn.refuse(decision)
      return
    }
    setPending(decision)
    // A request that never reaches the server must not lock the form.
    const result = await decideClinic(
      verificationId,
      decision === "approve"
        ? { submittedAt, decision, checklist: checked }
        : { submittedAt, decision, reason: reason.trim() }
    )
      .catch(() => ({ ok: false as const, error: "failed" as const }))
      .finally(() => setPending(null))
    if (!result.ok) {
      // The API said the sign-in is too old: the same message.
      if (result.error === "step-up") signIn.refuse(decision)
      else setError({ decision, code: result.error })
      return
    }
    signIn.forget()
    try {
      sessionStorage.setItem(DECIDED_KEY, verificationId)
    } catch {
      // Focus simply stays where the browser puts it.
    }
    toast.success(t(`toasts.${decision}`))
    router.refresh()
  }

  // Beside the button that was pressed: what went wrong, or, on an old
  // sign-in, the calm "not saved, sign in again" (a routine step, not
  // something that went wrong).
  function refusal(shown: (decision: Decision) => boolean) {
    const signInAgain = signIn.refusalFor(shown)
    if (signInAgain) return signInAgain
    if (!error || !shown(error.decision)) return null
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription data-testid="clinic-decision-error">
          {t(`errors.${error.code}`)}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {signIn.notice}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("checklistHelp")}</p>
        {CLINIC_CHECKLIST_ITEMS.map((item) => (
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
        {/* After the button, so it does not move under the pointer. */}
        {refusal((decision) => decision === "approve")}
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="clinic-decision-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="clinic-decision-reason"
            data-testid="clinic-decision-reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
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
            // On a sign-in the page knows is too old there is nothing to
            // confirm: the answer is that it was not saved.
            onPress={() =>
              signIn.expired ? void decide("reject") : setConfirmingReject(true)
            }
            data-testid="clinic-reject"
          >
            {pending === "reject" ? t("saving") : t("reject")}
          </Button>
        </div>
        {refusal((decision) => decision !== "approve")}
        <AlertDialog
          isOpen={confirmingReject}
          onOpenChange={setConfirmingReject}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rejectConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rejectConfirm.body")}
              <span className="mt-3 block text-sm font-medium text-foreground">
                {t("rejectConfirm.reason")}
              </span>
              {/* A long reason scrolls here, so the buttons stay in view. */}
              <span
                className="mt-1 block max-h-40 overflow-y-auto whitespace-pre-line text-foreground"
                tabIndex={0}
                data-testid="clinic-reject-reason"
              >
                {reason.trim()}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              isDisabled={pending !== null}
              data-testid="clinic-reject-cancel"
            >
              {t("rejectConfirm.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              isDisabled={pending !== null}
              onPress={() => {
                setConfirmingReject(false)
                void decide("reject")
              }}
              data-testid="clinic-reject-confirm"
            >
              {t("rejectConfirm.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialog>
      </div>
    </div>
  )
}
