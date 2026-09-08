import { getTranslations } from "next-intl/server"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth")
  return (
    <Card data-testid="verify-email">
      <CardHeader>
        <CardTitle>{t("verifyTitle")}</CardTitle>
        <CardDescription>{t("verifySent")}</CardDescription>
      </CardHeader>
    </Card>
  )
}
