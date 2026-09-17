import type { IvaDecision, IvaRegime } from "../../core/iva-matrix"
import { AdapterError } from "../../types"
import {
  resolveExemptionReasonId,
  resolveTaxRecord,
  type ToconlineLookupClient,
  type ToconlineTaxRecord,
} from "./lookups"

/**
 * GET-only TOConline tax/exemption resolution for a classified IVA
 * decision. Never POSTs `/api/v1/commercial_sales_documents`.
 */

export const REVERSE_CHARGE_EXEMPTION_CODE = "M07"

export type ResolvedIvaLookups =
  | {
      ok: true
      regime: Extract<IvaRegime, "pt_territorial" | "eu_reverse_charge">
      tax: ToconlineTaxRecord
      exemptionReasonId?: string
      exemptionCode?: string
    }
  | {
      ok: false
      regime: IvaRegime
      reason: string
    }

export async function resolveIvaLookups(
  client: ToconlineLookupClient,
  decision: IvaDecision
): Promise<ResolvedIvaLookups> {
  if (!decision.canIssue) {
    return {
      ok: false,
      regime: decision.regime,
      reason: decision.queueReason ?? "iva_regime_queued",
    }
  }

  if (decision.regime === "pt_territorial") {
    const tax = await resolveTaxRecord(client, {
      taxCode: "NOR",
      taxCountryRegion: decision.taxCountryRegion,
    })
    if (!tax || tax.taxPercentage === null) {
      return {
        ok: false,
        regime: decision.regime,
        reason: "pt_territorial_tax_lookup_unresolved",
      }
    }
    return { ok: true, regime: "pt_territorial", tax }
  }

  if (decision.regime === "eu_reverse_charge") {
    const [tax, exemptionReasonId] = await Promise.all([
      resolveTaxRecord(client, {
        taxCode: "ISE",
        taxCountryRegion: "PT",
      }),
      resolveExemptionReasonId(client, { code: REVERSE_CHARGE_EXEMPTION_CODE }),
    ])
    if (!tax) {
      return {
        ok: false,
        regime: decision.regime,
        reason: "reverse_charge_tax_lookup_unresolved",
      }
    }
    if (!exemptionReasonId) {
      return {
        ok: false,
        regime: decision.regime,
        reason: "reverse_charge_exemption_lookup_unresolved",
      }
    }
    return {
      ok: true,
      regime: "eu_reverse_charge",
      tax,
      exemptionReasonId,
      exemptionCode: REVERSE_CHARGE_EXEMPTION_CODE,
    }
  }

  return {
    ok: false,
    regime: decision.regime,
    reason: "iva_regime_not_issuable",
  }
}

export function assertLookupsAreGetOnly(method: string): void {
  if (method !== "GET") {
    throw new AdapterError(
      "validation",
      "IVA tax matrix may only GET TOConline lookups"
    )
  }
}
