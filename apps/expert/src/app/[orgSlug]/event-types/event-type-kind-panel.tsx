"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@eleva/ui/components/button"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { cn } from "@eleva/ui/lib/utils"
import type { EventTypeKind, EventTypeVisibility } from "@eleva/api-client"
import { updateEventTypeAction } from "./actions"

const KINDS: readonly EventTypeKind[] = ["non_clinical", "clinical"]
const VISIBILITIES: readonly EventTypeVisibility[] = [
  "public",
  "unlisted",
  "private",
]

function isVisibility(value: unknown): value is EventTypeVisibility {
  return (
    typeof value === "string" &&
    (VISIBILITIES as readonly string[]).includes(value)
  )
}

interface Props {
  eventTypeId: string
  kind: EventTypeKind
  visibility: EventTypeVisibility
}

export function EventTypeKindPanel({
  eventTypeId,
  kind: initialKind,
  visibility: initialVisibility,
}: Props) {
  const t = useTranslations("eventTypes.kind")
  const tRoot = useTranslations("eventTypes")
  const router = useRouter()
  const [kind, setKind] = React.useState(initialKind)
  const [visibility, setVisibility] = React.useState(initialVisibility)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  async function handleSave() {
    setPending(true)
    setError(null)
    setErrorMessage(null)
    const result = await updateEventTypeAction(eventTypeId, {
      kind,
      visibility,
    })
    if (result.ok) {
      toast.success(tRoot("saved"))
      router.refresh()
    } else {
      setError(result.error)
      setErrorMessage(result.message ?? null)
    }
    setPending(false)
  }

  const dirty = kind !== initialKind || visibility !== initialVisibility

  return (
    <Card data-testid="event-type-kind-panel">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage ??
                (error === "offer-invariant"
                  ? tRoot("error.offer-invariant")
                  : t("errorGeneric"))}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((option) => (
            <button
              key={option}
              type="button"
              data-testid={`kind-card-${option}`}
              onClick={() => setKind(option)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                kind === option
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-foreground/30"
              )}
            >
              <div className="font-medium">{t(`options.${option}.title`)}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`options.${option}.body`)}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Select
            selectedKey={visibility}
            onSelectionChange={(key) => {
              if (isVisibility(key)) setVisibility(key)
            }}
          >
            <Label>{t("visibilityLabel")}</Label>
            <SelectTrigger className="max-w-sm" data-testid="visibility-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITIES.map((value) => (
                <SelectItem
                  key={value}
                  id={value}
                  textValue={t(`visibility.${value}.title`)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{t(`visibility.${value}.title`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`visibility.${value}.body`)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onPress={handleSave}
          isDisabled={pending || !dirty}
          data-testid="kind-save"
        >
          {pending ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  )
}
