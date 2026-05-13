"use client"

import { useTranslations } from "next-intl"
import {
  ConnectPayouts,
  ConnectBalances,
  ConnectAccountManagement,
  ConnectTaxSettings,
} from "@eleva/billing/embedded"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Separator } from "@eleva/ui/components/separator"

export function FinanceDashboard() {
  const t = useTranslations("finance")

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("balance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectBalances />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("payouts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectPayouts />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("accountDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectAccountManagement />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("taxSettings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectTaxSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
