import { getTranslations } from "next-intl/server"
import { getUserOrganizations } from "@eleva/auth/server"
import { env, resolveGatewayUrl } from "@eleva/config/env"
import { spacePath } from "@eleva/config/routing"
import { CreditCardIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { hasBillableWorkspace } from "./billable"
import { BillingClient } from "./billing-client"

export default async function BillingPage() {
  const [t, organizations] = await Promise.all([
    getTranslations("billing"),
    getUserOrganizations(),
  ])
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  const stripePublishableKey = env().STRIPE_PUBLISHABLE_KEY ?? ""

  if (!hasBillableWorkspace(organizations)) {
    // Members pay per session; their receipts live in their Space.
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          title={t("title")}
          description={t("noWorkspace.description")}
        />
        <EmptyState
          icon={<CreditCardIcon aria-hidden />}
          title={t("noWorkspace.title")}
          action={
            <LinkButton
              href={`${resolveGatewayUrl()}${spacePath("payments")}`}
              variant="outline"
              size="sm"
            >
              {t("noWorkspace.action")}
            </LinkButton>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>
            {t("subscriptionTitle")}
          </SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("subscriptionDescription")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <BillingClient
              apiBaseUrl={apiBaseUrl}
              stripePublishableKey={stripePublishableKey}
            />
          </div>
        </SettingsFieldsetContent>
      </SettingsFieldset>
    </div>
  )
}
