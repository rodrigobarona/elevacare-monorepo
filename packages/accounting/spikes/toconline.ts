/**
 * Throwaway 07.0 runner against the founder TEST series only.
 *
 *   pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts
 *
 * Requires TOCONLINE_SERIES_PREFIX=TEST (or TEST-…). Live ELEVA exits 2
 * with no HTTP call.
 */
import {
  assertTestSeriesPrefix,
  isAllowedTestSeriesPrefix,
  normalizeTestSeriesPrefix,
} from "./series-guard"

const SPIKE_CUSTOMER_NIF = "999999990"
const SPIKE_CUSTOMER_NAME = "Eleva 07.0 spike TEST customer"
const SPIKE_SERVICE_CODE = "ELEVA-SPIKE-070"
const SPIKE_SERVICE_NAME = "Eleva 07.0 spike TEST service"
const SPIKE_UNIT_PRICE = 1

interface CheckResult {
  id: string
  status: "proven" | "failed" | "skipped"
  summary: string
  details?: unknown
}

const checks: CheckResult[] = []

function record(
  id: string,
  status: CheckResult["status"],
  summary: string,
  details?: unknown
): void {
  checks.push({ id, status, summary, details })
  const mark =
    status === "proven" ? "OK" : status === "failed" ? "FAIL" : "SKIP"
  console.log(`[${mark}] ${id}: ${summary}`)
}

function envHost(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  try {
    return new URL(value).host
  } catch {
    return "(unparseable URL)"
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function apiBase(): string {
  const value =
    process.env.TOCONLINE_API_BASE_URL || process.env.TOCONLINE_API_URL
  if (!value) {
    throw new Error("Missing TOCONLINE_API_BASE_URL / TOCONLINE_API_URL")
  }
  return value.replace(/\/$/, "")
}

function oauthBase(): string {
  const value =
    process.env.TOCONLINE_OAUTH_BASE_URL || process.env.TOCONLINE_OAUTH_URL
  if (!value) {
    throw new Error("Missing TOCONLINE_OAUTH_BASE_URL / TOCONLINE_OAUTH_URL")
  }
  return value.replace(/\/$/, "")
}

function redirectUri(): string {
  return (
    process.env.TOCONLINE_OAUTH_REDIRECT ||
    process.env.TOCONLINE_URI_REDIRECT ||
    "https://oauth.pstmn.io/v1/callback"
  )
}

function basicAuthHeader(): string {
  const id = requiredEnv("TOCONLINE_CLIENT_ID")
  const secret = requiredEnv("TOCONLINE_CLIENT_SECRET")
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`
}

function snippet(text: string, max = 400): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max)
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 24) return `${value.slice(0, 4)}…(${value.length} chars)`
    return value
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (/token|secret|password|authorization/i.test(key)) {
        out[key] = "<redacted>"
      } else {
        out[key] = redact(nested)
      }
    }
    return out
  }
  return value
}

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return "<unreadable body>"
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: snippet(text) }
  }
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

function attr(item: Record<string, unknown>, key: string): unknown {
  const attributes = item.attributes
  if (attributes && typeof attributes === "object") {
    return (attributes as Record<string, unknown>)[key]
  }
  return item[key]
}

async function request(
  method: string,
  path: string,
  accessToken: string,
  options?: { body?: unknown; family: "v1" | "legacy" }
): Promise<{
  status: number
  headers: Record<string, string>
  body: unknown
  raw: string
}> {
  const family =
    options?.family ?? (path.includes("/api/v1/") ? "v1" : "legacy")
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type":
      family === "v1" ? "application/json" : "application/vnd.api+json",
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body:
      options?.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const raw = await readBody(res)
  const interestingHeaders: Record<string, string> = {}
  for (const name of [
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
  ]) {
    const value = res.headers.get(name)
    if (value) interestingHeaders[name] = value
  }
  return {
    status: res.status,
    headers: interestingHeaders,
    body: parseJson(raw),
    raw,
  }
}

async function probeClientCredentials(): Promise<void> {
  const res = await fetch(`${oauthBase()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "commercial",
    }).toString(),
    redirect: "manual",
  })
  const raw = await readBody(res)
  record(
    "01b",
    res.ok ? "failed" : res.status === 501 ? "proven" : "failed",
    res.ok
      ? "client_credentials unexpectedly succeeded"
      : res.status === 501
        ? "client_credentials 501 Not Implemented; official flow is authorization_code"
        : `client_credentials returned ${res.status}, not 501; inconclusive`,
    { status: res.status, body: redact(parseJson(raw)) }
  )
}

interface Tokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
  authStyle: string
}

async function exchangeCode(code: string, authStyle: string): Promise<Tokens> {
  const res = await fetch(`${oauthBase()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      scope: "commercial",
    }).toString(),
  })
  const raw = await readBody(res)
  const json = parseJson(raw) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Token exchange failed (${res.status}): ${snippet(JSON.stringify(redact(json)))}`
    )
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
    authStyle,
  }
}

async function obtainTokens(): Promise<Tokens> {
  const existing = process.env.TOCONLINE_ACCESS_TOKEN
  if (existing) {
    return {
      accessToken: existing,
      refreshToken: process.env.TOCONLINE_REFRESH_TOKEN,
      authStyle: "env TOCONLINE_ACCESS_TOKEN",
    }
  }

  const clientId = process.env.TOCONLINE_CLIENT_ID
  const clientSecret = process.env.TOCONLINE_CLIENT_SECRET
  if (clientId && clientSecret && clientId === clientSecret) {
    throw new Error(
      "TOCONLINE_CLIENT_SECRET is identical to TOCONLINE_CLIENT_ID (placeholder). Paste the Dados API secret; token exchange will keep returning 403 access_denied until then."
    )
  }

  const authUrl = new URL(`${oauthBase()}/auth`)
  authUrl.searchParams.set("client_id", requiredEnv("TOCONLINE_CLIENT_ID"))
  authUrl.searchParams.set("redirect_uri", redirectUri())
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "commercial")

  const authRes = await fetch(authUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    redirect: "manual",
  })
  const location =
    authRes.headers.get("location") ?? authRes.headers.get("Location")
  if (location) {
    const redirected = new URL(location, redirectUri())
    const code = redirected.searchParams.get("code")
    if (code) {
      return exchangeCode(
        code,
        `GET /auth ${authRes.status} Location code (official simplified flow, no PKCE)`
      )
    }
  }

  throw new Error(
    `GET /auth did not return a 302 Location code (status ${authRes.status}). Interactive login is required; official docs expect Location: {redirect}?code=…`
  )
}

async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const res = await fetch(`${oauthBase()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "commercial",
    }).toString(),
  })
  const raw = await readBody(res)
  const json = parseJson(raw) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Refresh failed (${res.status}): ${snippet(JSON.stringify(redact(json)))}`
    )
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
    authStyle: "refresh_token + HTTP Basic",
  }
}

interface SeriesRow {
  id: string
  prefix: string
  documentType: string
  description?: string
}

function seriesFromItem(item: Record<string, unknown>): SeriesRow | null {
  const prefix = String(attr(item, "prefix") ?? "")
  const documentType = String(
    attr(item, "document_type") ?? attr(item, "documentType") ?? ""
  )
  const id = String(item.id ?? attr(item, "id") ?? "")
  if (!id || !prefix) return null
  return {
    id,
    prefix,
    documentType,
    description: String(attr(item, "description") ?? ""),
  }
}

async function loadSeries(
  accessToken: string,
  prefix: string,
  documentType: string
): Promise<SeriesRow[]> {
  const path = `/api/commercial_document_series?filter[document_type]=${encodeURIComponent(documentType)}&filter[prefix]=${encodeURIComponent(prefix)}`
  const res = await request("GET", path, accessToken)
  if (res.status >= 400) {
    throw new Error(`Series lookup failed (${res.status}): ${snippet(res.raw)}`)
  }
  return jsonApiItems(res.body)
    .map(seriesFromItem)
    .filter((row): row is SeriesRow => row !== null)
}

function pickTestSeries(rows: SeriesRow[], documentType: string): SeriesRow {
  const match = rows.find(
    (row) =>
      row.documentType === documentType && isAllowedTestSeriesPrefix(row.prefix)
  )
  if (!match) {
    throw new Error(
      `No ${documentType} series with an allowed TEST prefix. Found: ${
        rows.map((row) => `${row.prefix}/${row.documentType}`).join(", ") ||
        "(none)"
      }`
    )
  }
  if (match.prefix === "ELEVA" || match.prefix.startsWith("ELEVA")) {
    throw new Error("Refusing live ELEVA series after lookup")
  }
  return match
}

async function upsertCustomer(accessToken: string): Promise<string> {
  const search = await request(
    "GET",
    `/api/customers?filter[tax_registration_number]=${SPIKE_CUSTOMER_NIF}`,
    accessToken
  )
  if (search.status >= 400) {
    throw new Error(
      `Customer search failed (${search.status}): ${snippet(search.raw)}`
    )
  }
  const existing = jsonApiItems(search.body)[0]
  if (existing?.id) return String(existing.id)

  const created = await request("POST", "/api/customers", accessToken, {
    family: "legacy",
    body: {
      data: {
        type: "customers",
        attributes: {
          tax_registration_number: SPIKE_CUSTOMER_NIF,
          business_name: SPIKE_CUSTOMER_NAME,
          observations: "Throwaway 07.0 spike customer. Safe to keep.",
        },
      },
    },
  })
  const id = jsonApiItems(created.body)[0]?.id
  if (created.status >= 400 || !id) {
    throw new Error(
      `Customer create failed (${created.status}): ${snippet(created.raw)}`
    )
  }
  return String(id)
}

async function upsertService(accessToken: string): Promise<string> {
  const search = await request(
    "GET",
    `/api/services?filter[item_code]=${encodeURIComponent(SPIKE_SERVICE_CODE)}`,
    accessToken
  )
  if (search.status >= 400) {
    throw new Error(
      `Service search failed (${search.status}): ${snippet(search.raw)}`
    )
  }
  const existing = jsonApiItems(search.body)[0]
  if (existing?.id) return String(existing.id)

  const created = await request("POST", "/api/services", accessToken, {
    family: "legacy",
    body: {
      data: [
        {
          type: "services",
          attributes: {
            type: "Service",
            item_code: SPIKE_SERVICE_CODE,
            item_description: SPIKE_SERVICE_NAME,
            sales_price: SPIKE_UNIT_PRICE,
          },
        },
      ],
    },
  })
  const id = jsonApiItems(created.body)[0]?.id
  if (created.status >= 400 || !id) {
    throw new Error(
      `Service create failed (${created.status}): ${snippet(created.raw)}`
    )
  }
  return String(id)
}

interface IssuedDocument {
  id: string
  number?: string
  seriesPrefix?: string
  raw: unknown
}

function documentFromBody(body: unknown): IssuedDocument {
  const item = jsonApiItems(body)[0] ?? (body as Record<string, unknown>)
  const id = String(item.id ?? attr(item, "id") ?? "")
  const number = String(
    attr(item, "document_no") ??
      attr(item, "document_number") ??
      attr(item, "number") ??
      ""
  )
  const seriesPrefix = String(
    attr(item, "document_series_prefix") ??
      attr(item, "series_prefix") ??
      attr(item, "prefix") ??
      ""
  )
  return {
    id,
    number: number || undefined,
    seriesPrefix: seriesPrefix || undefined,
    raw: redact(body),
  }
}

function assertIssuedOnTest(doc: IssuedDocument, expectedPrefix: string): void {
  if (!doc.id) {
    throw new Error("Issued document missing id")
  }
  if (doc.seriesPrefix && !isAllowedTestSeriesPrefix(doc.seriesPrefix)) {
    throw new Error(
      `Issued document series ${doc.seriesPrefix} is not TEST. Aborting.`
    )
  }
  if (doc.number && /ELEVA/i.test(doc.number) && !/TEST/i.test(doc.number)) {
    throw new Error(
      `Issued document number ${doc.number} looks like live ELEVA`
    )
  }
  if (
    expectedPrefix !== "TEST" &&
    expectedPrefix.startsWith("TEST-") === false
  ) {
    throw new Error("Expected prefix drifted off TEST")
  }
}

async function issueSalesDocument(
  accessToken: string,
  input: {
    documentType: "FT" | "NC"
    series: SeriesRow
    customerId: string
    serviceId: string
    notes: string
    parentId?: string
    parentReference?: string
  }
): Promise<IssuedDocument> {
  if (!isAllowedTestSeriesPrefix(input.series.prefix)) {
    throw new Error(`Refusing to issue on series ${input.series.prefix}`)
  }
  const body: Record<string, unknown> = {
    document_type: input.documentType,
    document_series_id: Number(input.series.id) || input.series.id,
    document_series_prefix: input.series.prefix,
    customer_id: Number(input.customerId) || input.customerId,
    customer_tax_registration_number: SPIKE_CUSTOMER_NIF,
    customer_business_name: SPIKE_CUSTOMER_NAME,
    customer_country: "PT",
    payment_mechanism: "TB",
    vat_included_prices: true,
    currency_iso_code: "EUR",
    notes: input.notes,
    external_reference: `eleva-07.0-spike-${input.documentType.toLowerCase()}`,
    lines: [
      {
        item_type: "Service",
        item_id: Number(input.serviceId) || input.serviceId,
        item_code: SPIKE_SERVICE_CODE,
        description: SPIKE_SERVICE_NAME,
        quantity: 1,
        unit_price: SPIKE_UNIT_PRICE,
        tax_code: "NOR",
        tax_percentage: 23,
        tax_country_region: "PT",
      },
    ],
  }
  if (input.parentId) {
    body.parent_documents_ids = [Number(input.parentId) || input.parentId]
  }
  if (input.parentReference)
    body.parent_document_reference = input.parentReference

  const res = await request(
    "POST",
    "/api/v1/commercial_sales_documents",
    accessToken,
    { family: "v1", body }
  )
  if (res.status >= 400) {
    throw new Error(
      `${input.documentType} create failed (${res.status}): ${snippet(res.raw)}`
    )
  }
  const doc = documentFromBody(res.body)
  assertIssuedOnTest(doc, input.series.prefix)
  return doc
}

async function fetchPdf(
  accessToken: string,
  documentId: string
): Promise<{ status: number; urlHost?: string }> {
  const res = await request(
    "GET",
    `/api/url_for_print/${documentId}?filter[type]=Document&filter[copies]=1`,
    accessToken
  )
  if (res.status >= 400) {
    throw new Error(`PDF URL failed (${res.status}): ${snippet(res.raw)}`)
  }
  const item =
    jsonApiItems(res.body)[0] ?? (res.body as Record<string, unknown>)
  const scheme = String(attr(item, "scheme") ?? item.scheme ?? "https")
  const host = String(attr(item, "host") ?? item.host ?? "")
  const path = String(attr(item, "path") ?? item.path ?? "")
  if (!host || !path) {
    return { status: res.status }
  }
  return { status: res.status, urlHost: `${scheme}://${host}` }
}

async function sendToAt(
  accessToken: string,
  documentId: string
): Promise<{ status: number; body: unknown }> {
  const username = process.env.TOCONLINE_AT_USERNAME
  const password = process.env.TOCONLINE_AT_PASSWORD
  if (!username || !password) {
    throw new Error(
      "TOCONLINE_AT_USERNAME / TOCONLINE_AT_PASSWORD unset. Official AT payload requires Portal das Finanças entity_username + base64 entity_password."
    )
  }
  const res = await request(
    "PATCH",
    "/api/send_document_at_webservice",
    accessToken,
    {
      family: "legacy",
      body: {
        data: {
          type: "send_document_at_webservice",
          id: documentId,
          attributes: {
            document_type: "sales_document",
            entity_username: username,
            entity_password: Buffer.from(password).toString("base64"),
          },
        },
      },
    }
  )
  return { status: res.status, body: redact(res.body) }
}

async function main(): Promise<void> {
  const rawPrefix = process.env.TOCONLINE_SERIES_PREFIX
  try {
    assertTestSeriesPrefix(rawPrefix)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    console.error(
      `Current TOCONLINE_SERIES_PREFIX=${rawPrefix ?? "(unset)"}. Founder series is TEST. Set TOCONLINE_SERIES_PREFIX=TEST, never ELEVA.`
    )
    process.exit(2)
  }

  const prefix = normalizeTestSeriesPrefix(rawPrefix)

  console.log("07.0 spike: TEST series guard passed.")
  console.log(`series prefix: ${prefix}`)
  console.log(
    `API host (from env, not hardcoded): ${envHost("TOCONLINE_API_BASE_URL") ?? envHost("TOCONLINE_API_URL") ?? "(missing)"}`
  )
  console.log(
    `OAuth host (from env, not hardcoded): ${envHost("TOCONLINE_OAUTH_BASE_URL") ?? envHost("TOCONLINE_OAUTH_URL") ?? "(missing)"}`
  )
  console.log(
    `redirect set: ${redirectUri() ? "yes" : "no"}  client id set: ${process.env.TOCONLINE_CLIENT_ID ? "yes" : "no"}`
  )

  record("00", "proven", `Guard accepted prefix ${prefix}`)

  try {
    await probeClientCredentials()
  } catch (error) {
    record(
      "01b",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
  }

  let tokens: Tokens
  try {
    tokens = await obtainTokens()
    record("01", "proven", `OAuth ${tokens.authStyle}`, {
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
      hasRefresh: Boolean(tokens.refreshToken),
      apiHost:
        envHost("TOCONLINE_API_BASE_URL") ?? envHost("TOCONLINE_API_URL"),
      oauthHost:
        envHost("TOCONLINE_OAUTH_BASE_URL") ?? envHost("TOCONLINE_OAUTH_URL"),
    })
  } catch (error) {
    record(
      "01",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
    printSummary()
    process.exit(1)
  }

  if (tokens.refreshToken) {
    try {
      const refreshed = await refreshTokens(tokens.refreshToken)
      tokens = refreshed
      record(
        "08",
        "proven",
        `Refresh grant returned expires_in=${refreshed.expiresIn}`,
        {
          expiresIn: refreshed.expiresIn,
          tokenType: refreshed.tokenType,
        }
      )
    } catch (error) {
      record(
        "08",
        "failed",
        error instanceof Error ? error.message : String(error)
      )
    }
  } else {
    record("08", "skipped", "No refresh_token returned from authorization_code")
  }

  let ftSeries: SeriesRow
  let ncSeries: SeriesRow | undefined
  try {
    const ftRows = await loadSeries(tokens.accessToken, prefix, "FT")
    const ncRows = await loadSeries(tokens.accessToken, prefix, "NC")
    ftSeries = pickTestSeries(ftRows, "FT")
    try {
      ncSeries = ncRows.length > 0 ? pickTestSeries(ncRows, "NC") : undefined
    } catch (ncError) {
      ncSeries = undefined
      record(
        "07",
        "skipped",
        ncError instanceof Error ? ncError.message : String(ncError)
      )
    }
    if (ftSeries.prefix !== prefix && !ftSeries.prefix.startsWith(prefix)) {
      throw new Error(
        `Looked-up FT prefix ${ftSeries.prefix} does not match env ${prefix}`
      )
    }
    record(
      "01c",
      "proven",
      `TEST series FT id=${ftSeries.id} NC id=${ncSeries?.id ?? "none"}`,
      {
        ft: ftSeries,
        nc: ncSeries,
      }
    )
  } catch (error) {
    record(
      "01c",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
    printSummary()
    process.exit(1)
  }

  if (!ncSeries) {
    record(
      "04",
      "skipped",
      "No TEST NC series; refusing to issue an FT that cannot be credited"
    )
    record("05", "skipped", "No TEST NC series")
    record("06", "skipped", "No TEST NC series")
    printSummary()
    process.exit(1)
  }

  let customerId: string
  try {
    customerId = await upsertCustomer(tokens.accessToken)
    record(
      "02",
      "proven",
      `Customer id=${customerId} NIF=${SPIKE_CUSTOMER_NIF}`
    )
  } catch (error) {
    record(
      "02",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
    printSummary()
    process.exit(1)
  }

  let serviceId: string
  try {
    serviceId = await upsertService(tokens.accessToken)
    record("03", "proven", `Service id=${serviceId} code=${SPIKE_SERVICE_CODE}`)
  } catch (error) {
    record(
      "03",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
    printSummary()
    process.exit(1)
  }

  try {
    const bad = await request(
      "GET",
      "/api/v1/commercial_sales_documents/0",
      tokens.accessToken,
      { family: "v1" }
    )
    record(
      "09",
      bad.status >= 400 ? "proven" : "failed",
      `Error payload status=${bad.status}`,
      {
        status: bad.status,
        headers: bad.headers,
        body: redact(bad.body),
      }
    )
  } catch (error) {
    record(
      "09",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
  }

  let invoice: IssuedDocument | undefined
  try {
    invoice = await issueSalesDocument(tokens.accessToken, {
      documentType: "FT",
      series: ftSeries,
      customerId,
      serviceId,
      notes: "Eleva 07.0 spike throwaway invoice. TEST series only.",
    })
    record(
      "04",
      "proven",
      `FT id=${invoice.id} number=${invoice.number ?? "n/a"} series=${invoice.seriesPrefix ?? ftSeries.prefix}`,
      {
        id: invoice.id,
        number: invoice.number,
        seriesPrefix: invoice.seriesPrefix ?? ftSeries.prefix,
        seriesId: ftSeries.id,
      }
    )
  } catch (error) {
    record(
      "04",
      "failed",
      error instanceof Error ? error.message : String(error)
    )
  }

  if (invoice) {
    try {
      const pdf = await fetchPdf(tokens.accessToken, invoice.id)
      record(
        "05",
        pdf.urlHost ? "proven" : "failed",
        pdf.urlHost
          ? `PDF URL host ${pdf.urlHost}`
          : `PDF response ${pdf.status} missing host/path`
      )
    } catch (error) {
      record(
        "05",
        "failed",
        error instanceof Error ? error.message : String(error)
      )
    }

    let creditIssued = false
    try {
      const credit = await issueSalesDocument(tokens.accessToken, {
        documentType: "NC",
        series: ncSeries,
        customerId,
        serviceId,
        notes: `Eleva 07.0 spike credit note for FT ${invoice.number ?? invoice.id}`,
        parentId: invoice.id,
        parentReference: invoice.number,
      })
      creditIssued = true
      record(
        "07",
        "proven",
        `NC id=${credit.id} number=${credit.number ?? "n/a"}`,
        {
          id: credit.id,
          number: credit.number,
          seriesPrefix: credit.seriesPrefix ?? ncSeries.prefix,
        }
      )
    } catch (error) {
      record(
        "07",
        "failed",
        error instanceof Error ? error.message : String(error)
      )
    }

    if (process.env.TOCONLINE_SPIKE_SEND_AT !== "1") {
      record(
        "06",
        "skipped",
        "AT communication disabled; set TOCONLINE_SPIKE_SEND_AT=1 after a TEST NC exists"
      )
    } else if (!creditIssued) {
      record("06", "skipped", "AT skipped because the TEST credit note failed")
    } else {
      try {
        const at = await sendToAt(tokens.accessToken, invoice.id)
        record(
          "06",
          at.status < 400 ? "proven" : "failed",
          `AT status=${at.status}`,
          at
        )
      } catch (error) {
        record(
          "06",
          "failed",
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  } else {
    record("05", "skipped", "No invoice id")
    record("06", "skipped", "No invoice id")
    record("07", "skipped", "No invoice id")
  }

  printSummary()
  const failed = checks.some(
    (check) =>
      check.status === "failed" && ["01", "01c", "04", "07"].includes(check.id)
  )
  process.exit(failed ? 1 : 0)
}

function printSummary(): void {
  console.log("\n07.0 spike summary")
  console.log(JSON.stringify(checks, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  printSummary()
  process.exit(1)
})
