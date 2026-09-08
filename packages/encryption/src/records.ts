import { openWithDek, parseCiphertext, sealWithDek } from "./envelope"
import { EncryptionError } from "./errors"
import { getOrCreateOrgDek, getOrgDek } from "./keys"

function fieldAad(recordId: string, key: string): string {
  return `field:${recordId}:${key}`
}

export async function encryptRecordFields(
  orgId: string,
  fields: Record<string, string>,
  owner: { recordId: string }
): Promise<Record<string, string>> {
  const orgDek = await getOrCreateOrgDek(orgId)
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      sealWithDek(orgDek, value, fieldAad(owner.recordId, key)),
    ])
  )
}

export async function decryptRecordFields(
  orgId: string,
  fields: Record<string, string>,
  owner: { recordId: string }
): Promise<Record<string, string>> {
  const versions = new Set(
    Object.values(fields).map((value) => parseCiphertext(value).dekVersion)
  )
  const deks = new Map(
    await Promise.all(
      [...versions].map(async (version) => {
        return [version, await getOrgDek(orgId, version)] as const
      })
    )
  )
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      const parsed = parseCiphertext(value)
      const orgDek = deks.get(parsed.dekVersion)
      if (!orgDek) throw new EncryptionError("KEY_SHREDDED")
      return [key, openWithDek(orgDek, value, fieldAad(owner.recordId, key))]
    })
  )
}
