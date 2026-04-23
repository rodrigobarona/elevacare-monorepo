import { vaultNamespace, workos } from "./client"

/**
 * Vault reference stored in Eleva DB columns. The plaintext never
 * leaves WorkOS Vault; the DB only holds an opaque handle.
 *
 * Shape: "vault:<namespace>:<objectId>"
 */
export type VaultRef = `vault:${string}:${string}`

export function buildVaultRef(namespace: string, objectId: string): VaultRef {
  return `vault:${namespace}:${objectId}`
}

export function parseVaultRef(ref: string): {
  namespace: string
  objectId: string
} {
  const match = /^vault:([^:]+):(.+)$/.exec(ref)
  if (!match) {
    throw new Error(`Invalid vault ref: ${ref}`)
  }
  return { namespace: match[1]!, objectId: match[2]! }
}

/**
 * Store a plaintext value in WorkOS Vault and return the opaque ref
 * that should live in the DB column.
 *
 * @param context \u2014 free-form labels attached to the vault object for
 *   audit/debugging (e.g. { provider: 'google', userId: '...' }).
 */
export async function vaultPut(
  key: string,
  plaintext: string,
  context: Record<string, string> = {}
): Promise<VaultRef> {
  const ns = vaultNamespace()
  const client = workos()
  // WorkOS Vault API: see https://workos.com/docs/vault
  const object = await client.vault.createObject({
    name: key,
    value: plaintext,
    context: { ...context, namespace: ns },
  })
  return buildVaultRef(ns, object.id)
}

export async function vaultGet(ref: VaultRef): Promise<string> {
  const { objectId } = parseVaultRef(ref)
  const client = workos()
  const object = await client.vault.readObject({ id: objectId })
  if (object.value === undefined) {
    throw new Error(`Vault ref ${ref} has no accessible value`)
  }
  return object.value
}

export async function vaultDelete(ref: VaultRef): Promise<void> {
  const { objectId } = parseVaultRef(ref)
  const client = workos()
  await client.vault.deleteObject({ id: objectId })
}
