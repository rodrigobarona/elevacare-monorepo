"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { saveProfileStep } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

const LANGUAGE_OPTIONS = [
  { value: "pt", label: "Portuguese" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
]

const COUNTRY_OPTIONS = [
  { value: "PT", label: "Portugal" },
  { value: "ES", label: "Spain" },
  { value: "BR", label: "Brazil" },
]

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
  const [licenseScope, setLicenseScope] = React.useState(
    profile.licenseScope ?? ""
  )
  const [languages, setLanguages] = React.useState<string[]>(profile.languages)
  const [countries, setCountries] = React.useState<string[]>(
    profile.practiceCountries
  )
  const [worldwideMode, setWorldwideMode] = React.useState(
    profile.worldwideMode
  )
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
        licenseScope: licenseScope.trim() || undefined,
        languages,
        practiceCountries: countries,
        worldwideMode,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nif">NIF / Tax ID</Label>
          <Input
            id="nif"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            placeholder="123456789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="licenseScope">License scope</Label>
          <Input
            id="licenseScope"
            value={licenseScope}
            onChange={(e) => setLicenseScope(e.target.value)}
            placeholder="OPP 12345"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Languages</legend>
        <div className="flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 text-sm"
            >
              <Checkbox
                checked={languages.includes(opt.value)}
                onCheckedChange={() =>
                  setLanguages(toggleItem(languages, opt.value))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Practice countries</legend>
        <div className="flex flex-wrap gap-3">
          {COUNTRY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 text-sm"
            >
              <Checkbox
                checked={countries.includes(opt.value)}
                onCheckedChange={() =>
                  setCountries(toggleItem(countries, opt.value))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-sm">
          <Checkbox
            checked={worldwideMode}
            onCheckedChange={(v) => setWorldwideMode(v === true)}
          />
          Worldwide mode (non-clinical sessions only)
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Session modes</legend>
        <div className="flex flex-wrap gap-3">
          {SESSION_MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 text-sm"
            >
              <Checkbox
                checked={sessionModes.includes(opt.value)}
                onCheckedChange={() =>
                  setSessionModes(toggleItem(sessionModes, opt.value))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save & continue"}
      </Button>
    </form>
  )
}
