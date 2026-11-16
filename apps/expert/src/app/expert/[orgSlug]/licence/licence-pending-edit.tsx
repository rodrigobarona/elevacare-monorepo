"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { PencilSimpleIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import type { LicenceValue } from "../_components/licence-fields"
import { LicenceForm } from "./licence-form"

/**
 * The pending card's "what happens next" and details summary, with a quiet
 * "Edit details" action. Resubmitting refreshes the open application in
 * place, so the check restarts; the form says so before the expert sends.
 * While editing, the card shows only the form, and focus moves into it and
 * back to the button so keyboard and screen-reader users keep their place.
 */
export function LicencePendingEdit({
  initial,
  nextSteps,
  children,
}: {
  initial: LicenceValue
  nextSteps: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTranslations("licence.page")
  const [isEditing, setIsEditing] = React.useState(false)
  // The editor starts from the last details sent, not from the server
  // props: after a correction, `initial` only updates once the refresh
  // lands, and reopening before then must not offer the old details.
  const [baseline, setBaseline] = React.useState(initial)
  // Once refreshed props arrive, they become the baseline (adjusting state
  // during render when a prop changes, not in an effect).
  const initialKey = `${initial.professionalBody}|${initial.licenceNumber}|${initial.ersRegistrationNumber}`
  const [seenKey, setSeenKey] = React.useState(initialKey)
  if (seenKey !== initialKey) {
    setSeenKey(initialKey)
    setBaseline(initial)
  }
  const formRef = React.useRef<HTMLDivElement>(null)
  const editRef = React.useRef<HTMLButtonElement>(null)
  const opened = React.useRef(false)

  React.useEffect(() => {
    if (isEditing) {
      opened.current = true
      const first = formRef.current?.querySelector<HTMLElement>(
        "button, input, select, textarea"
      )
      first?.focus()
      first?.scrollIntoView({ block: "center", behavior: "smooth" })
    } else if (opened.current) {
      editRef.current?.focus()
    }
  }, [isEditing])

  if (!isEditing) {
    return (
      <>
        {nextSteps}
        <div className="space-y-4 border-t pt-4">
          {children}
          <Button
            ref={editRef}
            variant="outline"
            size="sm"
            onPress={() => setIsEditing(true)}
          >
            <PencilSimpleIcon />
            {t("edit.cta")}
          </Button>
        </div>
      </>
    )
  }

  return (
    <div ref={formRef} className="border-t pt-4">
      <LicenceForm
        initial={baseline}
        intro={t("edit.note")}
        showWhy={false}
        requireChange
        submitLabel={t("edit.submit")}
        successMessage={t("edit.sent")}
        onCancel={() => setIsEditing(false)}
        onSubmitted={(sent) => {
          setBaseline(sent)
          setIsEditing(false)
        }}
      />
    </div>
  )
}
