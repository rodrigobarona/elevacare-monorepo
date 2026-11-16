"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { type Icon, MapPinIcon, PhoneIcon, VideoCameraIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { cn } from "@eleva/ui/lib/utils"
import { saveProfileStep } from "./actions"
import { setupErrorMessage } from "./setup-errors"
import type { OnboardingProfile } from "./onboarding-wizard"

const SESSION_MODE_OPTIONS = [
  { value: "online", labelKey: "modeOnline", icon: VideoCameraIcon },
  { value: "in_person", labelKey: "modeInPerson", icon: MapPinIcon },
  { value: "phone", labelKey: "modePhone", icon: PhoneIcon },
] as const satisfies ReadonlyArray<{
  value: string
  labelKey: string
  icon: Icon
}>

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

  function toggleMode(mode: string) {
    setSessionModes((current) =>
      current.includes(mode)
        ? current.filter((v) => v !== mode)
        : [...current, mode]
    )
  }

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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          {t("profileStep.modes")}
        </legend>
        <p className="text-xs text-muted-foreground">
          {t("profileStep.modesHint")}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SESSION_MODE_OPTIONS.map(({ value, labelKey, icon: Icon }) => {
            const selected = sessionModes.includes(value)
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() => toggleMode(value)}
                  data-testid={`profile-session-mode-${value}`}
                />
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon weight="duotone" className="size-5" />
                </span>
                {t(`profileStep.${labelKey}`)}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div>
        <Button type="submit" size="lg" isPending={pending}>
          {pending ? t("profileStep.saving") : t("profileStep.submit")}
        </Button>
      </div>
    </form>
  )
}
