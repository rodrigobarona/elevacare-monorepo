"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
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

export function ResetPasswordForm() {
  const t = useTranslations("auth")
  const token = useSearchParams().get("token")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onRequest(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error: result } = await authClient.forgetPassword({
      email,
      redirectTo: "/reset-password",
    })
    setPending(false)
    if (result) {
      setError(result.message ?? t("errorGeneric"))
      return
    }
    setDone(true)
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setPending(true)
    setError(null)
    const { error: result } = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (result) {
      setError(result.message ?? t("errorGeneric"))
      return
    }
    setDone(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetTitle")}</CardTitle>
        <CardDescription>
          {token ? t("resetNewDescription") : t("resetRequestDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm text-muted-foreground">{t("resetDone")}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={token ? onReset : onRequest}
            data-testid="reset-password-form"
          >
            {token ? (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            )}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" isDisabled={pending}>
              {token ? t("resetSubmit") : t("resetRequest")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
