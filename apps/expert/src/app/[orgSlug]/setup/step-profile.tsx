"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { saveProfileStep } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

const SESSION_MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In Person" },
  { value: "phone", label: "Phone" },
]

interface Props {
  profile: OnboardingProfile
  onDone: () => void
}

export function StepProfile({ profile, onDone }: Props) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [nif, setNif] = React.useState(profile.nif ?? "")
  const [sessionModes, setSessionModes] = React.useState<string[]>(
    profile.sessionModes
  )

  function toggleItem(list: string[], item: string): string[] {
    return list.includes(item)
      ? list.filter((v) => v !== item)
      : [...list, item]
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

      if (result.ok) {
        onDone()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nif">NIF / Tax ID</Label>
        <Input
          id="nif"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          placeholder="123456789"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Session modes</legend>
        <div className="flex flex-wrap gap-3">
          {SESSION_MODE_OPTIONS.map((opt) => (
            <CheckboxField
              key={opt.value}
              id={`profile-session-mode-${opt.value}`}
              label={opt.label}
              isSelected={sessionModes.includes(opt.value)}
              onChange={() =>
                setSessionModes(toggleItem(sessionModes, opt.value))
              }
            />
          ))}
        </div>
      </fieldset>

      <Button type="submit" isDisabled={pending}>
        {pending ? "Saving..." : "Save & continue"}
      </Button>
    </form>
  )
}
