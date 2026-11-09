import { getTranslations } from "next-intl/server"
import { ShieldCheckIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { getApiBaseUrl } from "@/lib/server-api"
import { EnterStaffButton } from "./enter-staff-button"

/**
 * Shown when someone with a staff membership arrives while working in
 * another workspace. Entering is a deliberate step: it switches their
 * active workspace to the staff one.
 */
export async function StaffEntry({
  staffOrgId,
  backHref,
}: {
  staffOrgId: string
  backHref: string
}) {
  const t = await getTranslations("staffEntry")
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border bg-card p-8 shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <ShieldCheckIcon className="size-5 text-foreground" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <EnterStaffButton
            staffOrgId={staffOrgId}
            apiBaseUrl={getApiBaseUrl()}
            label={t("enter")}
            errorLabel={t("error")}
          />
          <LinkButton href={backHref} variant="ghost">
            {t("back")}
          </LinkButton>
        </div>
      </div>
    </main>
  )
}
