"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { createApiClient } from "@eleva/api-client"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@eleva/ui/components/card"
import type { Locale } from "@eleva/config/i18n"

interface Props {
  defaultName: string
  apiBaseUrl: string
  locale?: Locale
}

type ActionResult = { ok: true } | { ok: false; errorKey: string }

export function OnboardingForm({ defaultName, apiBaseUrl, locale }: Props) {
  const t = useTranslations("onboarding")
  const [state, setState] = React.useState<ActionResult>({
    ok: true,
  })
  const [isPending, setIsPending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setState({ ok: true })

    const formData = new FormData(event.currentTarget)
    const spaceName = (formData.get("spaceName") as string)?.trim()

    if (!spaceName || spaceName.length < 2) {
      setState({ ok: false, errorKey: "errorMinLength" })
      setIsPending(false)
      return
    }

    try {
      const api = createApiClient({ baseUrl: apiBaseUrl })
      await api.onboarding.complete({ spaceName, locale })
      window.location.assign("/dashboard")
    } catch (err) {
      console.error("onboarding API failed", err)
      setState({ ok: false, errorKey: "errorGeneric" })
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spaceName">{t("nameLabel")}</Label>
            <Input
              id="spaceName"
              name="spaceName"
              defaultValue={defaultName}
              placeholder={t("namePlaceholder")}
              required
              minLength={2}
              maxLength={100}
              autoFocus
              disabled={isPending}
            />
          </div>
          {!state.ok && state.errorKey && (
            <p className="text-sm text-destructive" role="alert">
              {t(state.errorKey)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t("submitting") : t("submit")}
          </Button>
          {isPending && (
            <p className="animate-pulse text-sm text-muted-foreground">
              {t("processingHint")}
            </p>
          )}
        </CardFooter>
      </Card>
    </form>
  )
}
