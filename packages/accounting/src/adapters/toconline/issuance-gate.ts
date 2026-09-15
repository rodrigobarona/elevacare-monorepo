import { AdapterError } from "../../types"

/**
 * v1 POST /api/v1/commercial_sales_documents auto-finalizes on submit
 * (`_context/TOConline-api/TOConline Full Documentation.md`, Documentos de
 * Venda). After create, finalize / cancel / update / delete are impossible
 * on this API version. Drafts belong on the previous API
 * (`POST /api/commercial_sales_documents` + lines + `status: 1`).
 *
 * Accountant 2026-09-15: do not finalize fictitious fiscal documents.
 * This increment never POSTs. 07.2.2 must keep this closed until fiscal
 * params are signed — do not treat TOCONLINE_ALLOW_V1_AUTO_FINALIZE as
 * permission to issue.
 */
export const TOC_V1_AUTO_FINALIZE_BLOCKED = "toconline_v1_auto_finalize_blocked"

export const TOC_V1_AUTO_FINALIZE_MESSAGE =
  "TOConline v1 auto-finalizes sales documents on create; issuance is blocked until accountant fiscal params are signed"

export function isV1SalesDocumentPostAllowed(_seriesPrefix?: string): boolean {
  return false
}

export function assertV1SalesDocumentPostAllowed(
  _seriesPrefix?: string
): never {
  throw new AdapterError(
    "fatal",
    TOC_V1_AUTO_FINALIZE_MESSAGE,
    TOC_V1_AUTO_FINALIZE_BLOCKED
  )
}
