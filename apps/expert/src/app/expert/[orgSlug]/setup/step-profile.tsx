"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { saveProfileStep } from "./actions"
import { setupErrorMessage } from "./setup-errors"
import type { OnboardingProfile } from "./onboarding-wizard"
import { SessionModesField } from "../_components/session-modes-field"

interface Props {
  profile: OnboardingProfile
  onDone: () => void
}

export function StepProfile({ profile, onDone }: Props) {
  const t = useTranslations("onboarding")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [nif, setNif] = React.useState(profile.nif ?? "")
  const [sessionModes, setSessionModes] = React.useState<string[]>(
    profile.sessionModes
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await saveProfileStep({
        nif: nif.trim() || undefined,
        sessionModes,
      })
      if (result.ok) onDone()
      else setError(setupErrorMessage(t, result.error))
    } catch {
      setError(setupErrorMessage(t, "save-failed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="nif">{t("profileStep.nif")}</Label>
        <Input
          id="nif"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="123456789"
          aria-describedby="nif-hint"
        />
        <p id="nif-hint" className="text-xs text-muted-foreground">
          {t("profileStep.nifHint")}
        </p>
      </div>

      <SessionModesField value={sessionModes} onChange={setSessionModes} />

      <div>
        <Button type="submit" size="lg" isPending={pending}>
          {pending ? t("profileStep.saving") : t("profileStep.submit")}
        </Button>
      </div>
    </form>
  )
}
