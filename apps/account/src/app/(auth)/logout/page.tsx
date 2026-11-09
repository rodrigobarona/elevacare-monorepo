import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { SignOutButton } from "./sign-out-button"

export default async function LogoutPage() {
  const t = await getTranslations("auth")
  const hdrs = await headers()
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logoutTitle")}</CardTitle>
        <CardDescription>{t("logoutDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignOutButton
          gatewayUrl={resolveGatewayUrl(host)}
          label={t("signOut")}
          errorLabel={t("errorGeneric")}
        />
      </CardContent>
    </Card>
  )
}
