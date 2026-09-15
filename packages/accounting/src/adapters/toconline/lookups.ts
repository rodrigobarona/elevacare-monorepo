import { isToconlineApiHostname } from "@eleva/config/env"
import { AdapterError } from "../../types"

/**
 * TOConline JSON:API lookups used to resolve internal ids before a v1
 * sales-document POST. Paths follow
 * https://api-docs.toconline.pt (Documentos de Venda notes 1–10 + APIs
 * Auxiliares). Do not invent fields.
 *
 * These helpers only GET. They never Comunicar a série and never POST
 * `/api/v1/commercial_sales_documents`.
 */

export interface ToconlineLookupClient {
  apiBase: string
  accessToken: string
}

export interface ResolveDocumentSeriesInput {
  documentType: string
  prefix: string
}

export interface ResolveTaxInput {
  taxCode: string
  taxCountryRegion: string
  taxPercentage?: number
}

export interface ResolveCustomerInput {
  taxRegistrationNumber: string
}

export interface ResolveExemptionReasonInput {
  /** Legal exemption code, e.g. M07 / M99 — resolve, never hardcode id 7/99. */
  code: string
}

export interface ResolveCurrencyInput {
  isoCode: string
}

export interface ResolveServiceInput {
  itemCode: string
}

export interface ResolveCountryInput {
  isoAlpha2: string
}

export interface OssTaxRow {
  id: string
  attributes: Record<string, unknown>
}

function jsonApiItems(body: unknown): Array<Record<string, unknown>> {
  if (!body || typeof body !== "object") return []
  const data = (body as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    )
  }
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function jsonApiId(item: Record<string, unknown>): string | null {
  const id = item.id
  if (typeof id === "string" && id.length > 0) return id
  if (typeof id === "number" && Number.isFinite(id)) return String(id)
  return null
}

function pickUniqueId(
  items: Array<Record<string, unknown>>,
  context: string
): string | null {
  const ids = items.map(jsonApiId).filter((id): id is string => id !== null)
  if (ids.length === 0) return null
  if (ids.length > 1) {
    throw new AdapterError(
      "validation",
      `TOConline ${context} lookup returned ${ids.length} matches`
    )
  }
  return ids[0] ?? null
}

function filterQuery(
  filters: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue
    params.set(`filter[${key}]`, String(value))
  }
  return params.toString()
}

const LOOKUP_TIMEOUT_MS = 10_000

function assertToconlineApiBase(apiBase: string): string {
  let url: URL
  try {
    url = new URL(apiBase)
  } catch {
    throw new AdapterError(
      "validation",
      "TOConline API base is not a valid URL"
    )
  }
  if (url.protocol !== "https:") {
    throw new AdapterError("validation", "TOConline API base must use HTTPS")
  }
  const hostname = url.hostname.toLowerCase()
  // Dados API hosts are api{n}.toconline.pt per company. Do not pin api33;
  // still reject apex, nested, and arbitrary *.toconline.pt hosts.
  if (!isToconlineApiHostname(hostname)) {
    throw new AdapterError(
      "validation",
      "TOConline API host must be api{n}.toconline.pt"
    )
  }
  return apiBase.replace(/\/$/, "")
}

async function getJsonApi(
  client: ToconlineLookupClient,
  path: string
): Promise<unknown> {
  const origin = assertToconlineApiBase(client.apiBase)
  let res: Response
  try {
    res = await fetch(`${origin}${path}`, {
      method: "GET",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/vnd.api+json",
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AdapterError("retryable", "TOConline lookup timed out")
    }
    throw err
  }
  if (res.status === 401) {
    throw new AdapterError(
      "credentials",
      "TOConline access token rejected during lookup"
    )
  }
  if (res.status === 429) {
    throw new AdapterError("retryable", "TOConline rate limit during lookup")
  }
  if (!res.ok) {
    throw new AdapterError(
      "provider",
      `TOConline lookup failed: ${res.status} ${path}`,
      String(res.status)
    )
  }
  try {
    return (await res.json()) as unknown
  } catch {
    throw new AdapterError("provider", "TOConline lookup returned non-JSON")
  }
}

export async function resolveDocumentSeriesId(
  client: ToconlineLookupClient,
  input: ResolveDocumentSeriesInput
): Promise<string | null> {
  const query = filterQuery({
    document_type: input.documentType,
    prefix: input.prefix,
  })
  const body = await getJsonApi(
    client,
    `/api/commercial_document_series?${query}`
  )
  return pickUniqueId(jsonApiItems(body), "document series")
}

export async function resolveTaxId(
  client: ToconlineLookupClient,
  input: ResolveTaxInput
): Promise<string | null> {
  const query = filterQuery({
    tax_code: input.taxCode,
    tax_country_region: input.taxCountryRegion,
    tax_percentage: input.taxPercentage,
  })
  const body = await getJsonApi(client, `/api/taxes?${query}`)
  return pickUniqueId(jsonApiItems(body), "tax")
}

export async function resolveCustomerId(
  client: ToconlineLookupClient,
  input: ResolveCustomerInput
): Promise<string | null> {
  const query = filterQuery({
    tax_registration_number: input.taxRegistrationNumber,
  })
  const body = await getJsonApi(client, `/api/customers?${query}`)
  return pickUniqueId(jsonApiItems(body), "customer")
}

export async function resolveExemptionReasonId(
  client: ToconlineLookupClient,
  input: ResolveExemptionReasonInput
): Promise<string | null> {
  const query = filterQuery({ code: input.code })
  const body = await getJsonApi(client, `/api/tax_exemption_reasons?${query}`)
  return pickUniqueId(jsonApiItems(body), "tax exemption reason")
}

export async function resolveCurrencyId(
  client: ToconlineLookupClient,
  input: ResolveCurrencyInput
): Promise<string | null> {
  const query = filterQuery({ iso_code: input.isoCode })
  const body = await getJsonApi(client, `/api/currencies?${query}`)
  return pickUniqueId(jsonApiItems(body), "currency")
}

export async function resolveServiceId(
  client: ToconlineLookupClient,
  input: ResolveServiceInput
): Promise<string | null> {
  const query = filterQuery({ item_code: input.itemCode })
  const body = await getJsonApi(client, `/api/services?${query}`)
  return pickUniqueId(jsonApiItems(body), "service")
}

export async function resolveCountryId(
  client: ToconlineLookupClient,
  input: ResolveCountryInput
): Promise<string | null> {
  const query = filterQuery({ iso_alpha_2: input.isoAlpha2 })
  const body = await getJsonApi(client, `/api/countries?${query}`)
  return pickUniqueId(jsonApiItems(body), "country")
}

export async function listOssTaxes(
  client: ToconlineLookupClient
): Promise<OssTaxRow[]> {
  const body = await getJsonApi(client, "/api/oss_taxes")
  return jsonApiItems(body)
    .map((item) => {
      const id = jsonApiId(item)
      if (!id) return null
      const attributes =
        item.attributes && typeof item.attributes === "object"
          ? (item.attributes as Record<string, unknown>)
          : {}
      return { id, attributes }
    })
    .filter((row): row is OssTaxRow => row !== null)
}
