"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"

function callbackUrl(returnTo: string | null): string {
  return sanitizeReturnTo(returnTo) ?? "/dashboard"
}

export function LoginForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const next = callbackUrl(returnTo)

  async function onPassword(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error: result } = await authClient.signIn.email({
      email,
      password,
      callbackURL: next,
    })
    setPending(false)
    if (result) setError(result.message ?? t("errorGeneric"))
  }

  async function onMagic() {
    setPending(true)
    setError(null)
    const { error: result } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
    })
    setPending(false)
    if (result) {
      setError(result.message ?? t("errorGeneric"))
      return
    }
    setMagicSent(true)
  }

  async function onGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: next })
  }

  async function onPasskey() {
    const { error: result } = await authClient.signIn.passkey()
    if (result) setError(result.message ?? t("errorGeneric"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={onPassword}
          data-testid="login-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              data-testid="login-email"
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
              autoComplete="current-password"
              data-testid="login-password"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {magicSent ? (
            <p className="text-sm text-muted-foreground">{t("magicSent")}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            isDisabled={pending}
            data-testid="login-submit"
          >
            {t("signIn")}
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onPress={onMagic}
          isDisabled={pending || !email}
          data-testid="login-magic"
        >
          {t("magicLink")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onPress={onGoogle}
          data-testid="login-google"
        >
          {t("google")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onPress={onPasskey}
          data-testid="login-passkey"
        >
          {t("passkey")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <LinkButton href="/signup" variant="link" className="h-auto p-0">
            {t("signUp")}
          </LinkButton>
        </p>
      </CardContent>
    </Card>
  )
}
