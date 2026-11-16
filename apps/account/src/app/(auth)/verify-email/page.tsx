import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getAuthUser } from "@eleva/auth/server"
import { CheckCircleIcon, ClockIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { AuthHeading, AuthStep } from "@/components/auth-ui"

/**
 * Where the email verification link lands (Better Auth `callbackURL`).
 *
 * Signup shows its own "check your inbox" step, so people only reach this
 * page after opening the link:
 *   - verified and signed in (`autoSignInAfterVerification`) → their Space;
 *   - `?error=` (expired, used, or bad token) → explain and offer sign-in;
 *   - signed out, no error → the email was already confirmed earlier (Better
 *     Auth only redirects in that case, it does not start a session).
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  if (!error && (await getAuthUser())) redirect("/dashboard")

  const t = await getTranslations("auth")
  const failed = Boolean(error)

  return (
    <AuthStep data-testid={failed ? "verify-email-failed" : "verify-email"}>
      <AuthHeading
        icon={
          failed ? (
            <ClockIcon weight="duotone" />
          ) : (
            <CheckCircleIcon weight="duotone" />
          )
        }
        title={failed ? t("verifyFailedTitle") : t("verifiedTitle")}
        description={failed ? t("verifyFailedBody") : t("verifiedBody")}
      />
      <LinkButton
        href="/login"
        size="lg"
        className="h-11 w-full"
        data-testid="verify-email-sign-in"
      >
        {t("signIn")}
      </LinkButton>
    </AuthStep>
  )
}
