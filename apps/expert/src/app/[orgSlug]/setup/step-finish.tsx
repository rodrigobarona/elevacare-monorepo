"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  CalendarDotsIcon,
  ClockIcon,
  RocketLaunchIcon,
  SparkleIcon,
  TagIcon,
} from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { markStepComplete } from "./actions"
import { setupErrorMessage } from "./setup-errors"

const ITEM_ICONS = [TagIcon, ClockIcon, CalendarDotsIcon, SparkleIcon]

interface Props {
  workspaceBase: string
}

export function StepFinish({ workspaceBase }: Props) {
  const t = useTranslations("onboarding")
  const items = t.raw("finish.items") as string[]
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFinish() {
    setPending(true)
    setError(null)
    try {
      const result = await markStepComplete("schedule")
      if (result.ok) {
        window.location.assign(workspaceBase)
        return
      }
      setError(setupErrorMessage(t, result.error))
    } catch {
      setError(setupErrorMessage(t, "save-failed"))
    }
    setPending(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="relative isolate overflow-hidden rounded-2xl bg-teal-900 p-6 text-white">
        <div
          aria-hidden
          className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-teal-500/40 blur-3xl"
        />
        <RocketLaunchIcon weight="duotone" className="size-9 text-teal-100" />
        <p className="mt-3 font-heading text-xl text-balance">
          {t("finish.title")}
        </p>
        <p className="mt-1 text-sm text-teal-50/80">{t("finish.body")}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => {
          const Icon = ITEM_ICONS[index % ITEM_ICONS.length]!
          return (
            <li
              key={item}
              className="flex items-start gap-3 rounded-2xl border p-4 text-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon weight="duotone" className="size-5" />
              </span>
              <span className="pt-1.5 text-pretty">{item}</span>
            </li>
          )
        })}
      </ul>

      <div>
        <Button
          size="lg"
          isPending={pending}
          onPress={() => void handleFinish()}
          data-testid="setup-finish"
        >
          {pending ? t("finish.finishing") : t("finish.submit")}
        </Button>
      </div>
    </div>
  )
}
