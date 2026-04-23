import { vaultDelete, vaultGet, vaultPut, type VaultRef } from "./vault"

/**
 * Encrypted-record helpers used by S5 transcript + report storage.
 * Every sensitive artifact (transcript content, report body, session
 * notes) is stored in Vault; the DB holds only the opaque ref +
 * metadata.
 */

export async function encryptRecord(
  key: string,
  payload: unknown,
  context: Record<string, string> = {}
): Promise<VaultRef> {
  return vaultPut(key, JSON.stringify(payload), context)
}

export async function decryptRecord<T = unknown>(ref: VaultRef): Promise<T> {
  const raw = await vaultGet(ref)
  return JSON.parse(raw) as T
}

export async function deleteRecord(ref: VaultRef): Promise<void> {
  await vaultDelete(ref)
}
