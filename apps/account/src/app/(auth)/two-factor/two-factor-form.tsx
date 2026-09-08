"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient, MFA_RETURN_TO_STORAGE_KEY } from "@eleva/auth/client"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"

function readStoredReturnTo(): string | undefined {
  try {
    return sanitizeReturnTo(sessionStorage.getItem(MFA_RETURN_TO_STORAGE_KEY))
  } catch {
    return undefined
  }
}

export function TwoFactorForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const result = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code })
    setPending(false)
    if (result.error) {
      setError(result.error.message ?? t("errorGeneric"))
      return
    }
    const next =
      sanitizeReturnTo(searchParams.get("returnTo")) ??
      readStoredReturnTo() ??
      "/dashboard"
    window.location.assign(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("twoFactorTitle")}</CardTitle>
        <CardDescription>{t("twoFactorDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={onSubmit}
          data-testid="two-factor-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">
              {useBackup ? t("backupCode") : t("totpCode")}
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              data-testid="two-factor-code"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            isDisabled={pending}
            data-testid="two-factor-submit"
          >
            {t("verify")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onPress={() => setUseBackup((value) => !value)}
          >
            {useBackup ? t("useTotp") : t("useBackup")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
