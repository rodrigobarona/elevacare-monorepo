import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { getAuthedApiClient } from "@/lib/server-api"
import { InvoiceList } from "./invoice-list"
import { MonthlyExport } from "./monthly-export"

export const dynamic = "force-dynamic"

export default async function ExpertInvoicesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session } = await loadExpertWorkspace(
    orgSlug,
    "expert:invoicing_manage"
  )

  const [t, api] = await Promise.all([
    getTranslations("finance.invoices"),
    getAuthedApiClient(),
  ])
  const { invoices, nextCursor } = await api.invoicing.listExpert()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={expertWorkspacePath(session, "finance")}
          className="hover:underline"
        >
          {t("backToFinance")}
        </Link>
        <span>/</span>
        <span>{t("title")}</span>
      </div>
      <AccountPageHeader title={t("title")} description={t("description")} />
      <MonthlyExport />
      <InvoiceList invoices={invoices} nextCursor={nextCursor} />
    </div>
  )
}
