"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
import { toGatewayCallbackURL } from "@eleva/auth/return-to"
import {
  ArrowRightIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
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
} from "@/components/auth-ui"

type Step = "email" | "details" | "verify" | "magicSent"

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function LegalLinks() {
  const t = useTranslations("auth")
  return (
    <>
      <a className="underline underline-offset-2" href="/legal/terms">
        {t("terms")}
      </a>{" "}
      {t("consentAnd")}{" "}
      <a className="underline underline-offset-2" href="/legal/privacy">
        {t("privacy")}
      </a>
    </>
  )
}

export function SignupForm({
  initialName = "",
  initialEmail = "",
  claimGuest = false,
}: {
  initialName?: string
  initialEmail?: string
  claimGuest?: boolean
}) {
  const t = useTranslations("auth")
  const [step, setStep] = useState<Step>(initialEmail ? "details" : "email")
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const claimingGuest =
    claimGuest && initialEmail.length > 0 && sameEmail(email, initialEmail)

  function goTo(nextStep: Step) {
    setError(null)
    setStep(nextStep)
  }

  async function sendMagicLink(): Promise<boolean> {
    const { error: magicError } = await authClient.signIn.magicLink({
      email,
      callbackURL: toGatewayCallbackURL("/dashboard"),
    })
    if (magicError) {
      setError(authErrorMessage(magicError, t))
      return false
    }
    return true
  }

  async function resendVerification(): Promise<boolean> {
    const { error: result } = await authClient.sendVerificationEmail({
      email,
      callbackURL: toGatewayCallbackURL("/verify-email"),
    })
    if (result) {
      setError(authErrorMessage(result, t))
      return false
    }
    return true
  }

  async function submitSignup() {
    if (!consent) {
      setError(t("consentRequired"))
      return
    }
    setPending(true)
    setError(null)
    try {
      // Guest-activation already provisioned this address. signUp.email can
      // return a synthetic success under requireEmailVerification and would
      // not store the typed password, so the confirmation CTA claims the
      // account with a magic link. Password signup stays for a different
      // address the visitor types themselves.
      if (claimingGuest) {
        if (await sendMagicLink()) goTo("magicSent")
        return
      }
      const { error: result } = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: toGatewayCallbackURL("/verify-email"),
      })
      if (result) {
        setError(authErrorMessage(result, t))
        return
      }
      goTo("verify")
    } finally {
      setPending(false)
    }
  }

  function onEmail(e: FormEvent) {
    e.preventDefault()
    setEmail(email.trim())
    goTo("details")
  }

  function onDetails(e: FormEvent) {
    e.preventDefault()
    void submitSignup()
  }

  async function onGoogle() {
    setGooglePending(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: toGatewayCallbackURL("/dashboard"),
      errorCallbackURL: new URL("/login", window.location.href).toString(),
    })
  }

  const errorText = error ? (
    <p
      className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in-0"
      role="alert"
      data-testid="signup-error"
    >
      {error}
    </p>
  ) : null

  if (step === "magicSent" || step === "verify") {
    const isMagic = step === "magicSent"
    return (
      <AuthStep data-testid={isMagic ? "signup-magic-sent" : "verify-email"}>
        <AuthHeading
          icon={<EnvelopeIcon weight="duotone" />}
          title={isMagic ? t("magicSentTitle") : t("verifyTitle")}
          description={
            isMagic ? t("magicSentBody", { email }) : t("verifyBody", { email })
          }
        />
        <InboxActions
          email={email}
          onResend={isMagic ? sendMagicLink : resendVerification}
        />
        {errorText}
      </AuthStep>
    )
  }

  if (step === "details") {
    return (
      <AuthStep key="details">
        <AuthHeading
          title={t("signupDetailsTitle")}
          description={
            claimingGuest
              ? t("signupClaimDescription")
              : t("signupDetailsDescription")
          }
        />
        <EmailChip email={email} onChange={() => goTo("email")} />
        <form
          className="flex flex-col gap-4"
          onSubmit={onDetails}
          data-testid="signup-form"
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
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus={!name}
              required
              className="h-11"
              data-testid="signup-name"
            />
          </div>
          {claimingGuest ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus={Boolean(name)}
                  minLength={8}
                  required
                  aria-describedby="password-hint"
                  className="h-11 pr-12"
                  data-testid="signup-password"
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
              <p id="password-hint" className="text-sm text-muted-foreground">
                {t("passwordHint")}
              </p>
            </div>
          )}
          <CheckboxField
            isSelected={consent}
            onChange={setConsent}
            data-testid="signup-consent"
            label={
              <span>
                {t("consentPrefix")} <LegalLinks />
              </span>
            }
          />
          {errorText}
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            isPending={pending}
            data-testid="signup-submit"
          >
            {claimingGuest ? t("magicLink") : t("createAccount")}
          </Button>
        </form>
      </AuthStep>
    )
  }

  return (
    <AuthStep key="email">
      <AuthHeading
        title={t("signupTitle")}
        description={t("signupDescription")}
      />
      <div className="flex flex-col gap-2">
        <GoogleSignInButton
          label={t("google")}
          onPress={() => void onGoogle()}
          isPending={googlePending}
          data-testid="signup-google"
        />
        <p className="text-center text-xs text-pretty text-muted-foreground">
          {t("googleConsentPrefix")} <LegalLinks />.
        </p>
      </div>
      <AuthDivider />
      <form
        className="flex flex-col gap-4"
        onSubmit={onEmail}
        data-testid="signup-email-form"
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
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
            className="h-11"
            data-testid="signup-email"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="group h-11 w-full"
          data-testid="signup-continue"
        >
          {t("continue")}
          <ArrowRightIcon
            data-icon="inline-end"
            className="transition-transform group-data-hovered:translate-x-0.5"
          />
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <LinkButton
          href={
            email
              ? `/login?email=${encodeURIComponent(email.trim())}`
              : "/login"
          }
          variant="link"
          className="h-auto p-0"
        >
          {t("signIn")}
        </LinkButton>
      </p>
    </AuthStep>
  )
}
