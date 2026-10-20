import { getTranslations } from "next-intl/server"
import { redirectToGatewayLogin } from "@eleva/auth/guards"
import { getUserOrganizations } from "@eleva/auth/server"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  DownloadSimpleIcon,
  ShieldCheckIcon,
  TrashIcon,
  type Icon,
} from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { PageHeader } from "@eleva/ui/components/page-header"

export const dynamic = "force-dynamic"

const CONTROLS: { key: "consents" | "export" | "deletion"; icon: Icon }[] = [
  { key: "consents", icon: ShieldCheckIcon },
  { key: "export", icon: DownloadSimpleIcon },
  { key: "deletion", icon: TrashIcon },
]

export default async function PrivacyPage() {
  const [t, organizations] = await Promise.all([
    getTranslations("privacy"),
    getUserOrganizations(),
  ])
  if (!organizations) redirectToGatewayLogin()

  const space = organizations.find((org) => org.orgType === "personal")
  const controlsUrl = space
    ? `${resolveGatewayUrl()}/${space.orgSlug}/privacy`
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <section className="rounded-3xl border bg-card p-6 shadow-1 sm:p-8">
        <ul className="grid gap-5 sm:grid-cols-3">
          {CONTROLS.map(({ key, icon: ControlIcon }) => (
            <li key={key} className="space-y-2">
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-5"
              >
                <ControlIcon />
              </span>
              <h2 className="font-medium">{t(`controls.${key}.title`)}</h2>
              <p className="text-sm text-muted-foreground">
                {t(`controls.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-sm text-muted-foreground">
            {controlsUrl ? t("spaceHint") : t("noSpace")}
          </p>
          {controlsUrl ? (
            <LinkButton href={controlsUrl} size="sm">
              {t("openControls")}
            </LinkButton>
          ) : null}
        </div>
      </section>
    </div>
  )
}
