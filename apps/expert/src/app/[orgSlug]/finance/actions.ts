"use server"

import { z } from "zod"
import { guardSessionForOrg } from "@eleva/auth"
import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"

const ExportFinanceCsvSchema = z.object({
  orgSlug: z.string().min(1).max(80),
})

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export async function exportFinanceCsv(orgSlug: string): Promise<
  | {
      ok: true
      csv: string
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = ExportFinanceCsvSchema.parse({ orgSlug })
    const scoped = await guardSessionForOrg(parsed.orgSlug)
    if (
      scoped.orgSlug !== parsed.orgSlug ||
      !scoped.capabilities.includes("payouts:view_own")
    ) {
      return { ok: false, error: "forbidden" }
    }
    const cookieSession = await requireSession()
    if (cookieSession.orgId !== scoped.orgId) {
      return { ok: false, error: "org-mismatch" }
    }
    const api = await getAuthedApiClient()
    const finance = await api.me.financeSummary()
    const header = [
      "bookingId",
      "bookingPaymentId",
      "amountCents",
      "feeCents",
      "netCents",
      "payoutStatus",
      "eligibleAt",
    ]
    const lines = [
      header.join(","),
      ...finance.bookings.map((row) =>
        [
          row.bookingId,
          row.bookingPaymentId,
          String(row.amountCents),
          String(row.feeCents),
          String(row.netCents),
          row.payoutStatus ?? "",
          row.eligibleAt ?? "",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ]
    return { ok: true, csv: lines.join("\n") }
  } catch (err) {
    console.error("[finance] exportFinanceCsv failed", err)
    return { ok: false, error: "export-failed" }
  }
}
