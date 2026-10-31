import type { LegacyObject, LegacyStore } from "./migrate"

const PUBLIC_BASE = "https://ptrfw8k5nah8ubqb.public.blob.vercel-storage.com"
const LIST_API = "https://vercel.com/api/blob"
/** Matches `@vercel/blob` 2.3.3, which this replaces with plain HTTP. */
const API_VERSION = "12"

function privateBaseFromToken(token: string): string {
  // Blob tokens are `vercel_blob_rw_<storeId>_<secret>`.
  const storeId = token.split("_")[3]
  if (!storeId) throw new Error("BLOB_PRIVATE_READ_WRITE_TOKEN is malformed")
  return `https://${storeId}.private.blob.vercel-storage.com`
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/")
}

async function readObject(
  url: string,
  headers?: Record<string, string>
): Promise<LegacyObject | null> {
  const response = await fetch(url, { headers })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`legacy read failed with ${response.status}`)
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  }
}

export function createLegacyBlobStore(input: {
  publicToken?: string
  privateToken?: string
  publicBase?: string
  privateBase?: string
  listApi?: string
}): LegacyStore {
  const { publicToken, privateToken } = input
  const publicBase = input.publicBase ?? PUBLIC_BASE
  const listApi = input.listApi ?? LIST_API
  return {
    async listMediaKeys() {
      if (!publicToken) return null
      const keys: string[] = []
      let cursor: string | undefined
      do {
        const params = new URLSearchParams({ prefix: "media/", limit: "1000" })
        if (cursor) params.set("cursor", cursor)
        const response = await fetch(`${listApi}?${params.toString()}`, {
          headers: {
            authorization: `Bearer ${publicToken}`,
            "x-api-version": API_VERSION,
          },
        })
        if (!response.ok) {
          throw new Error(`legacy list failed with ${response.status}`)
        }
        const page = (await response.json()) as {
          blobs: { pathname: string }[]
          hasMore: boolean
          cursor?: string
        }
        keys.push(...page.blobs.map((blob) => blob.pathname))
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
      return keys
    },
    readPublic: (key) => readObject(`${publicBase}/${encodeKey(key)}`),
    async readPrivate(key) {
      if (!privateToken) {
        throw new Error("BLOB_PRIVATE_READ_WRITE_TOKEN is required")
      }
      const base = input.privateBase ?? privateBaseFromToken(privateToken)
      return readObject(`${base}/${encodeKey(key)}`, {
        authorization: `Bearer ${privateToken}`,
      })
    },
  }
}
