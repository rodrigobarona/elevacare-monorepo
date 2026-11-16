"use client"

import { useTranslations } from "next-intl"
import {
  CheckCircleIcon,
  type Icon,
  MapPinIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

/**
 * How the expert meets members (online, in person, phone). Shared by the
 * setup "profile" step and the public-profile settings.
 */
const SESSION_MODE_OPTIONS = [
  { value: "online", labelKey: "modeOnline", icon: VideoCameraIcon },
  { value: "in_person", labelKey: "modeInPerson", icon: MapPinIcon },
  { value: "phone", labelKey: "modePhone", icon: PhoneIcon },
] as const satisfies ReadonlyArray<{
  value: string
  labelKey: string
  icon: Icon
}>

export type SessionMode = (typeof SESSION_MODE_OPTIONS)[number]["value"]

export function SessionModesField({
  value,
  onChange,
  hint,
  hideLegend = false,
}: {
  value: string[]
  onChange: (next: string[]) => void
  /** Replaces the default hint under the legend. */
  hint?: string
  /** Keeps the legend for screen readers only, under a card title that says the same. */
  hideLegend?: boolean
}) {
  const t = useTranslations("onboarding.profileStep")

  function toggle(mode: string) {
    onChange(
      value.includes(mode) ? value.filter((v) => v !== mode) : [...value, mode]
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend
        className={cn("mb-1 text-sm font-medium", hideLegend && "sr-only")}
      >
        {t("modes")}
      </legend>
      <p className="text-sm text-muted-foreground">{hint ?? t("modesHint")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SESSION_MODE_OPTIONS.map(({ value: mode, labelKey, icon: Icon }) => {
          const selected = value.includes(mode)
          return (
            <label
              key={mode}
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
                onChange={() => toggle(mode)}
                data-testid={`profile-session-mode-${mode}`}
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
              <span className="flex-1">{t(labelKey)}</span>
              {selected ? (
                <CheckCircleIcon
                  aria-hidden
                  weight="fill"
                  className="size-5 text-primary"
                />
              ) : null}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
