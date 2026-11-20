import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getFlag } from "@eleva/flags"
import { BackLink } from "@eleva/dashboard/back-link"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
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

  // Rows exist only while Eleva tracks member invoices; without them the
  // page has nothing true to show, so it is not offered.
  if (!(await getFlag("ff.expert_invoicing_apps_enabled"))) notFound()

  const [t, api] = await Promise.all([
    getTranslations("finance.invoices"),
    getAuthedApiClient(),
  ])
  const { invoices, nextCursor } = await api.invoicing.listExpert()

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-4">
        <BackLink href={expertWorkspacePath(session, "finance")}>
          {t("backToFinance")}
        </BackLink>
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <Section title={t("listTitle")}>
        <InvoiceList invoices={invoices} nextCursor={nextCursor} />
      </Section>
      <Section title={t("exportTitle")} description={t("exportHint")}>
        <MonthlyExport />
      </Section>
    </div>
  )
}
