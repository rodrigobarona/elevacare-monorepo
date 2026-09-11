import { createHmac, timingSafeEqual } from "node:crypto"
import { uploadPrivateBlob } from "@eleva/storage"
import { ensurePhase5DsarCollectors } from "./dsar-phase5-collectors"
import { listDsarCollectors } from "./dsar-collectors"
import { createZipBuffer } from "./zip"

export const DSAR_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60

export type DsarExportResult = {
  blobPathname: string
  blobUrl: string
  expiresAt: Date
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)
}

function csvBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv.endsWith("\n") ? csv : `${csv}\n`)
}

export async function dsarExport(userId: string): Promise<DsarExportResult> {
  ensurePhase5DsarCollectors()
  const collectors = listDsarCollectors()
  const entries: { name: string; data: Uint8Array }[] = []

  for (const collector of collectors) {
    const result = await collector.collect(userId)
    const stem = result.filename.replace(/\.(json|csv)$/i, "")
    entries.push({ name: `${stem}.json`, data: jsonBytes(result.json) })
    if (result.csv != null) {
      entries.push({ name: `${stem}.csv`, data: csvBytes(result.csv) })
    }
  }

  const zip = createZipBuffer(entries)
  const uploaded = await uploadPrivateBlob({
    pathname: `dsar/${userId}/export.zip`,
    body: zip,
    contentType: "application/zip",
  })

  return {
    blobPathname: uploaded.pathname,
    blobUrl: uploaded.url,
    expiresAt: new Date(Date.now() + DSAR_SIGNED_URL_TTL_SECONDS * 1000),
  }
}

function dsarSigningSecret(): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to sign DSAR download URLs")
  }
  return secret
}

export function signDsarDownloadToken(dsarId: string, exp: number): string {
  return createHmac("sha256", dsarSigningSecret())
    .update(`${dsarId}:${exp}`)
    .digest("base64url")
}

export function verifyDsarDownloadToken(
  dsarId: string,
  exp: number,
  signature: string
): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
  const expected = Buffer.from(signDsarDownloadToken(dsarId, exp))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export function buildDsarDownloadUrl(input: {
  apiBaseUrl: string
  dsarId: string
  expiresAt: Date
}): string {
  const exp = Math.floor(input.expiresAt.getTime() / 1000)
  const sig = signDsarDownloadToken(input.dsarId, exp)
  const base = input.apiBaseUrl.replace(/\/+$/, "")
  return `${base}/privacy/dsar/${input.dsarId}/file?exp=${exp}&sig=${sig}`
}
