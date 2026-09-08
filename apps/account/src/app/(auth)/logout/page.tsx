import { getTranslations } from "next-intl/server"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { logoutAction } from "./actions"

export default async function LogoutPage() {
  const t = await getTranslations("auth")
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logoutTitle")}</CardTitle>
        <CardDescription>{t("logoutDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={logoutAction}>
          <Button type="submit" className="w-full" data-testid="logout-submit">
            {t("signOut")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
