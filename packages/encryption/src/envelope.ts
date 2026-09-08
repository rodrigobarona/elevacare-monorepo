import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { EncryptionError } from "./errors"
import { getOrCreateOrgDek, getOrgDek, type UnwrappedOrgDek } from "./keys"

const AES_ALGO = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

export interface ParsedCiphertext {
  format: "v1"
  kekVersion: number
  dekVersion: number
  iv: Buffer
  tag: Buffer
  data: Buffer
}

export function parseCiphertext(ciphertext: string): ParsedCiphertext {
  if (!ciphertext.startsWith("v1:")) {
    throw new EncryptionError(
      "UNSUPPORTED_CIPHERTEXT",
      "Vault ciphertext is no longer readable"
    )
  }
  const parts = ciphertext.split(":")
  if (parts.length !== 6 || parts[0] !== "v1") {
    throw new EncryptionError("INVALID_CIPHERTEXT")
  }
  const [, kekRaw, dekRaw, ivB64, tagB64, dataB64] = parts
  if (!kekRaw || !dekRaw || !ivB64 || !tagB64 || !dataB64) {
    throw new EncryptionError("INVALID_CIPHERTEXT")
  }
  const kekVersion = Number(kekRaw)
  const dekVersion = Number(dekRaw)
  if (!Number.isInteger(kekVersion) || !Number.isInteger(dekVersion)) {
    throw new EncryptionError("INVALID_CIPHERTEXT")
  }
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new EncryptionError("INVALID_CIPHERTEXT")
  }
  return {
    format: "v1",
    kekVersion,
    dekVersion,
    iv,
    tag,
    data: Buffer.from(dataB64, "base64"),
  }
}

export function sealWithDek(
  orgDek: UnwrappedOrgDek,
  plaintext: string,
  aad?: string
): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGO, orgDek.dek, iv)
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"))
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    "v1",
    orgDek.kekVersion,
    String(orgDek.keyVersion),
    iv.toString("base64"),
    tag.toString("base64"),
    data.toString("base64"),
  ].join(":")
}

export function openWithDek(
  orgDek: UnwrappedOrgDek,
  ciphertext: string | ParsedCiphertext,
  aad?: string
): string {
  const parsed =
    typeof ciphertext === "string" ? parseCiphertext(ciphertext) : ciphertext
  const decipher = createDecipheriv(AES_ALGO, orgDek.dek, parsed.iv)
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"))
  decipher.setAuthTag(parsed.tag)
  try {
    return Buffer.concat([
      decipher.update(parsed.data),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new EncryptionError("DECRYPT_FAILED")
  }
}

export async function encryptForOrg(
  orgId: string,
  plaintext: string,
  aad?: string
): Promise<string> {
  return sealWithDek(await getOrCreateOrgDek(orgId), plaintext, aad)
}

export async function decryptForOrg(
  orgId: string,
  ciphertext: string,
  aad?: string
): Promise<string> {
  const parsed = parseCiphertext(ciphertext)
  return openWithDek(await getOrgDek(orgId, parsed.dekVersion), parsed, aad)
}
