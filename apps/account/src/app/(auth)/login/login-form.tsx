"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient, MFA_RETURN_TO_STORAGE_KEY } from "@eleva/auth/client"
import { toGatewayCallbackURL } from "@eleva/auth/return-to"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FingerprintIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { GoogleSignInButton } from "@eleva/ui/components/google-sign-in-button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  AuthDivider,
  AuthHeading,
  AuthStep,
  EmailChip,
  InboxActions,
  authErrorMessage,
  oauthErrorCallbackURL,
  oauthErrorMessage,
} from "@/components/auth-ui"

type Step = "email" | "password" | "magicSent"

export function LoginForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const next = toGatewayCallbackURL(searchParams.get("returnTo"))
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(searchParams.get("error"), t)
  )
  const [pending, setPending] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const autofillStarted = useRef(false)

  function finish() {
    setSignedIn(true)
    window.location.assign(next)
  }

  // Passkey autofill: the browser offers saved passkeys from the email field
  // (`autocomplete="username webauthn"`). Unsupported browsers return an error
  // we ignore; an explicit passkey sign-in aborts this pending request.
  useEffect(() => {
    if (autofillStarted.current) return
    autofillStarted.current = true
    void authClient.signIn.passkey({
      autoFill: true,
      fetchOptions: {
        onSuccess() {
          setSignedIn(true)
          window.location.assign(next)
        },
      },
    })
  }, [next])

  function goTo(nextStep: Step) {
    setError(null)
    setStep(nextStep)
  }

  function onEmail(e: FormEvent) {
    e.preventDefault()
    setEmail(email.trim())
    goTo("password")
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      sessionStorage.setItem(MFA_RETURN_TO_STORAGE_KEY, next)
    } catch {
      // Private mode or disabled storage — MFA still works without returnTo.
    }
    const { error: result, data } = await authClient.signIn.email({
      email,
      password,
      callbackURL: next,
    })
    if (data?.twoFactorRedirect) {
      window.location.assign(`/two-factor?returnTo=${encodeURIComponent(next)}`)
      return
    }
    if (result) {
      setPending(false)
      setError(authErrorMessage(result, t))
      return
    }
    finish()
  }

  async function sendMagicLink(): Promise<boolean> {
    const { error: result } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
    })
    if (result) {
      setError(authErrorMessage(result, t))
      return false
    }
    return true
  }

  async function onMagic() {
    setPending(true)
    setError(null)
    const sent = await sendMagicLink()
    setPending(false)
    if (sent) goTo("magicSent")
  }

  async function onGoogle() {
    setGooglePending(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: oauthErrorCallbackURL(),
    })
  }

  async function onPasskey() {
    setError(null)
    const { error: result } = await authClient.signIn.passkey({
      fetchOptions: { onSuccess: finish },
    })
    if (result && result.code !== "AUTH_CANCELLED") {
      setError(authErrorMessage(result, t))
    }
  }

  const errorText = error ? (
    <p
      className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in-0"
      role="alert"
      data-testid="login-error"
    >
      {error}
    </p>
  ) : null

  if (step === "magicSent") {
    return (
      <AuthStep data-testid="login-magic-sent">
        <AuthHeading
          icon={<EnvelopeIcon weight="duotone" />}
          title={t("magicSentTitle")}
          description={t("magicSentBody", { email })}
        />
        <InboxActions email={email} onResend={sendMagicLink} />
        {errorText}
        <Button
          variant="link"
          className="self-center"
          onPress={() => goTo("email")}
        >
          {t("useDifferentEmail")}
        </Button>
      </AuthStep>
    )
  }

  if (step === "password") {
    return (
      <AuthStep key="password">
        <AuthHeading
          title={t("loginTitle")}
          description={t("passwordStepDescription")}
        />
        <EmailChip email={email} onChange={() => goTo("email")} />
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void onPassword(e)}
          data-testid="login-form"
        >
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">{t("password")}</Label>
              <LinkButton
                href={`/reset-password?email=${encodeURIComponent(email)}`}
                variant="link"
                className="h-auto p-0 text-sm"
                data-testid="login-forgot-password"
              >
                {t("forgotPassword")}
              </LinkButton>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
                className="h-11 pr-12"
                data-testid="login-password"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full"
                aria-label={
                  showPassword ? t("hidePassword") : t("showPassword")
                }
                onPress={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </Button>
            </div>
          </div>
          {errorText}
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            isPending={pending || signedIn}
            data-testid="login-submit"
          >
            {signedIn ? (
              <>
                <CheckCircleIcon
                  weight="fill"
                  data-icon="inline-start"
                  className="motion-safe:animate-in motion-safe:zoom-in-50"
                />
                {t("signedIn")}
              </>
            ) : pending ? (
              t("signingIn")
            ) : (
              t("signIn")
            )}
          </Button>
        </form>
        <AuthDivider />
        <Button
          variant="outline"
          size="lg"
          className="h-11 w-full"
          onPress={() => void onMagic()}
          isDisabled={pending}
          data-testid="login-magic"
        >
          <EnvelopeIcon data-icon="inline-start" />
          {t("magicLink")}
        </Button>
      </AuthStep>
    )
  }

  return (
    <AuthStep key="email">
      <AuthHeading
        title={t("loginTitle")}
        description={t("loginDescription")}
      />
      <GoogleSignInButton
        label={t("google")}
        onPress={() => void onGoogle()}
        isPending={googlePending}
        data-testid="login-google"
      />
      <AuthDivider />
      <form
        className="flex flex-col gap-4"
        onSubmit={onEmail}
        data-testid="login-email-form"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="username webauthn"
            inputMode="email"
            autoFocus
            required
            className="h-11"
            data-testid="login-email"
          />
        </div>
        {errorText}
        <Button
          type="submit"
          size="lg"
          className="group h-11 w-full"
          data-testid="login-continue"
        >
          {t("continue")}
          <ArrowRightIcon
            data-icon="inline-end"
            className="transition-transform group-data-hovered:translate-x-0.5"
          />
        </Button>
      </form>
      <Button
        variant="ghost"
        className="self-center text-muted-foreground"
        onPress={() => void onPasskey()}
        data-testid="login-passkey"
      >
        <FingerprintIcon data-icon="inline-start" />
        {t("passkey")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <LinkButton
          href={
            email
              ? `/signup?email=${encodeURIComponent(email.trim())}`
              : "/signup"
          }
          variant="link"
          className="h-auto p-0"
        >
          {t("signUp")}
        </LinkButton>
      </p>
    </AuthStep>
  )
}
