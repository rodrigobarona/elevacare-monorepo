"use server"

import { z } from "zod"
import {
  ApiClientError,
  ExpertInvoiceActionRequestSchema,
  ExpertInvoiceActionResponseSchema,
  ExportSaftQuerySchema,
  ExportSaftResponseSchema,
  ListExpertInvoicesResponseSchema,
  type ExpertInvoice,
  type ExportSaftResponse,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

const BookingIdSchema = z.string().uuid()
const CursorSchema = z.string().uuid()

export const INVOICE_ERROR_CODES = [
  "flag_disabled",
  "not_found",
  "already_issued",
  "not_retryable",
  "already_manual",
  "payment_not_succeeded",
  "forbidden",
  "validation",
  "blocked",
  "conflict",
] as const

type InvoiceErrorCode = (typeof INVOICE_ERROR_CODES)[number]

function isInvoiceErrorCode(value: string): value is InvoiceErrorCode {
  return (INVOICE_ERROR_CODES as readonly string[]).includes(value)
}

type ActionResult =
  | { ok: true; invoice: ExpertInvoice }
  | { ok: false; error: string }

function mapInvoiceError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code =
      err.body && typeof err.body.error === "string"
        ? err.body.error
        : undefined
    if (code && isInvoiceErrorCode(code)) return code
    if (err.status === 403) return "forbidden"
    if (err.status === 404) return "not_found"
    if (err.status === 409) return "conflict"
    if (err.status === 422) return "validation"
  }
  return "generic"
}

async function withInvoiceAction(
  bookingId: string,
  run: (
    api: Awaited<ReturnType<typeof getAuthedApiClient>>,
    id: string
  ) => Promise<ExpertInvoice>
): Promise<ActionResult> {
  let id: string
  try {
    id = BookingIdSchema.parse(bookingId)
    ExpertInvoiceActionRequestSchema.parse({})
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("expert:invoicing_manage")
    const api = await getAuthedApiClient()
    const invoice = ExpertInvoiceActionResponseSchema.parse(await run(api, id))
    revalidateExpertWorkspace(session, "finance/invoices")
    return { ok: true, invoice }
  } catch (err) {
    console.error("[invoices] action failed", err)
    return { ok: false, error: mapInvoiceError(err) }
  }
}

export async function retryExpertInvoiceAction(
  bookingId: string
): Promise<ActionResult> {
  return withInvoiceAction(bookingId, (api, id) =>
    api.invoicing.retryExpert(id, {})
  )
}

export async function markExpertInvoiceManualAction(
  bookingId: string
): Promise<ActionResult> {
  return withInvoiceAction(bookingId, (api, id) =>
    api.invoicing.markExpertManual(id, {})
  )
}

export async function exportSaftAction(
  month: string
): Promise<
  { ok: true; export: ExportSaftResponse } | { ok: false; error: string }
> {
  let parsedMonth: string
  try {
    parsedMonth = ExportSaftQuerySchema.parse({ month }).month
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    await requireSession("expert:invoicing_manage")
    const api = await getAuthedApiClient()
    const result = ExportSaftResponseSchema.parse(
      await api.invoicing.exportSaft({ month: parsedMonth })
    )
    return { ok: true, export: result }
  } catch (err) {
    console.error("[invoices] exportSaft failed", err)
    return { ok: false, error: mapInvoiceError(err) }
  }
}

export async function listMoreExpertInvoicesAction(cursor: string): Promise<
  | {
      ok: true
      invoices: z.infer<typeof ListExpertInvoicesResponseSchema>["invoices"]
      nextCursor: string | null
    }
  | { ok: false; error: string }
> {
  let parsedCursor: string
  try {
    parsedCursor = CursorSchema.parse(cursor)
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    await requireSession("expert:invoicing_manage")
    const api = await getAuthedApiClient()
    const result = await api.invoicing.listExpert({ cursor: parsedCursor })
    return { ok: true, ...result }
  } catch (err) {
    console.error("[invoices] listMore failed", err)
    return { ok: false, error: mapInvoiceError(err) }
  }
}
