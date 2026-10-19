import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@eleva/icons"
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

  const [t, api] = await Promise.all([
    getTranslations("finance.invoices"),
    getAuthedApiClient(),
  ])
  const { invoices, nextCursor } = await api.invoicing.listExpert()

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-4">
        <Link
          href={expertWorkspacePath(session, "finance")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("backToFinance")}
        </Link>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
      </div>
      <Section title={t("listTitle")} description={t("listHint")}>
        <InvoiceList invoices={invoices} nextCursor={nextCursor} />
      </Section>
      <Section title={t("exportTitle")} description={t("exportHint")}>
        <MonthlyExport />
      </Section>
    </div>
  )
}
