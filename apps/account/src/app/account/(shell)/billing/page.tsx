import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { BillingClient } from "./billing-client"

export default async function BillingPage() {
  const t = await getTranslations("billing")
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("description")} />
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
    </>
  )
}
