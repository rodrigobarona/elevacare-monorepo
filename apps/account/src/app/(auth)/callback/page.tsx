import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { WarningIcon } from "@eleva/icons"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { AuthHeading, AuthStep } from "@/components/auth-ui"

/** Codes Better Auth sends when the sign-in step expired or ran twice. */
const RESTART_CODES = new Set(["state_mismatch", "please_restart_the_process"])

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>
}) {
  const params = await searchParams
  const home = sanitizeReturnTo(params.returnTo) ?? "/dashboard"
  if (!params.error) redirect(home)

  // Better Auth sends failed sign-ins and account links here
  // (`onAPIError.errorURL`).
  const t = await getTranslations("auth")
  return (
    <AuthStep data-testid="auth-callback-error">
      <AuthHeading
        icon={<WarningIcon weight="duotone" />}
        title={t("callbackErrorTitle")}
        description={
          params.error === "access_denied"
            ? t("callbackErrorDenied")
            : RESTART_CODES.has(params.error)
              ? t("callbackErrorRestart")
              : t("callbackErrorGeneric")
        }
      />
      {/* A plain link: /dashboard is a Route Handler that picks the home. */}
      <a
        href={home}
        className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
      >
        {t("callbackErrorBack")}
      </a>
    </AuthStep>
  )
}
