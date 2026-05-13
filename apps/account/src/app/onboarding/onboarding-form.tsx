"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
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
import { createSpace } from "./actions"

interface Props {
  defaultName: string
}

export function OnboardingForm({ defaultName }: Props) {
  const t = useTranslations("onboarding")

  const [state, formAction, isPending] = useActionState(createSpace, {
    ok: true,
  })

  return (
    <form action={formAction}>
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
            />
          </div>
          {!state.ok && state.errorKey && (
            <p className="text-sm text-destructive" role="alert">
              {t(state.errorKey)}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
