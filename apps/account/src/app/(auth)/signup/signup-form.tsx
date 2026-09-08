"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"

export function SignupForm() {
  const t = useTranslations("auth")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      setError(t("consentRequired"))
      return
    }
    setPending(true)
    setError(null)
    const { error: result } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "/verify-email",
    })
    setPending(false)
    if (result) {
      setError(result.message ?? t("errorGeneric"))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <Card data-testid="verify-email">
        <CardHeader>
          <CardTitle>{t("verifyTitle")}</CardTitle>
          <CardDescription>{t("verifySent")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signupTitle")}</CardTitle>
        <CardDescription>{t("signupDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={onSubmit}
          data-testid="signup-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              data-testid="signup-name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              data-testid="signup-email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              data-testid="signup-password"
              required
            />
          </div>
          <CheckboxField
            isSelected={consent}
            onChange={setConsent}
            data-testid="signup-consent"
            label={
              <span>
                {t("consentPrefix")}{" "}
                <a className="underline" href="/legal/terms">
                  {t("terms")}
                </a>{" "}
                {t("consentAnd")}{" "}
                <a className="underline" href="/legal/privacy">
                  {t("privacy")}
                </a>
              </span>
            }
          />
          {error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="signup-error"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            isDisabled={pending}
            data-testid="signup-submit"
          >
            {t("createAccount")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <LinkButton href="/login" variant="link" className="h-auto p-0">
              {t("signIn")}
            </LinkButton>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
