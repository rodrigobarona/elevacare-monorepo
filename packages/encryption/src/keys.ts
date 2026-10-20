import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { and, eq, isNull, ne } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { EncryptionError } from "./errors"

const KEK_ENV = /^ELEVA_KEK_V(\d+)$/
const AES_ALGO = "aes-256-gcm"
const IV_LENGTH = 12
const DEK_LENGTH = 32

export interface OrgDekRow {
  id: string
  orgId: string
  keyVersion: number
  kekVersion: string
  wrappedDek: string
  retiredAt: Date | null
}

export interface UnwrappedOrgDek extends OrgDekRow {
  dek: Buffer
}

export interface OrgDekStore {
  findActive(orgId: string): Promise<OrgDekRow | undefined>
  findByVersion(
    orgId: string,
    keyVersion: number
  ): Promise<OrgDekRow | undefined>
  listAll(orgId: string): Promise<OrgDekRow[]>
  /** Orgs with at least one DEK row wrapped by a KEK other than `kekVersion`. */
  listOrgIdsNotWrappedWith(kekVersion: string, limit: number): Promise<string[]>
  insertIfAbsent(row: {
    orgId: string
    keyVersion: number
    kekVersion: string
    wrappedDek: string
  }): Promise<OrgDekRow | undefined>
  updateWrapped(
    orgId: string,
    keyVersion: number,
    wrappedDek: string,
    kekVersion: string
  ): Promise<void>
  deleteAll(orgId: string): Promise<OrgDekRow[]>
}

let storeOverride: OrgDekStore | undefined
let kekCache: Map<number, Buffer> | undefined

export function __setOrgDekStoreForTests(store?: OrgDekStore): void {
  storeOverride = store
}

export function __resetKekCacheForTests(): void {
  kekCache = undefined
}

export function loadKekMap(): Map<number, Buffer> {
  if (kekCache) return kekCache
  const map = new Map<number, Buffer>()
  for (const [key, value] of Object.entries(process.env)) {
    const match = KEK_ENV.exec(key)
    if (!match || !value) continue
    const buf = Buffer.from(value, "base64")
    if (buf.length !== 32) {
      throw new EncryptionError("INVALID_KEK", `${key} must be 32 bytes base64`)
    }
    map.set(Number(match[1]), buf)
  }
  if (map.size === 0) {
    throw new EncryptionError("KEK_MISSING", "ELEVA_KEK_V<n> is required")
  }
  kekCache = map
  return map
}

/**
 * `ENCRYPTION_KEK_VERSION` pins the wrap version; unset means the highest
 * loaded `ELEVA_KEK_V<n>`. A pin with no matching key refuses to run.
 */
export function currentKekVersion(): number {
  const kekMap = loadKekMap()
  const pinned = process.env.ENCRYPTION_KEK_VERSION?.trim()
  if (pinned) {
    const version = parseKekVersion(pinned)
    if (!kekMap.has(version)) {
      throw new EncryptionError(
        "KEK_VERSION_NOT_LOADED",
        `ENCRYPTION_KEK_VERSION=${version} but ELEVA_KEK_V${version} is not set`
      )
    }
    return version
  }
  const versions = [...kekMap.keys()]
  let max = versions[0]
  if (max === undefined) {
    throw new EncryptionError("KEK_MISSING", "ELEVA_KEK_V<n> is required")
  }
  for (let i = 1; i < versions.length; i++) {
    const version = versions[i]
    if (version !== undefined && version > max) max = version
  }
  return max
}

function kekBytes(version: number): Buffer {
  const kek = loadKekMap().get(version)
  if (!kek) {
    throw new EncryptionError("KEK_MISSING", `ELEVA_KEK_V${version} is not set`)
  }
  return kek
}

export function wrapDek(
  dek: Buffer,
  kekVersion: number,
  aad: { orgId: string; keyVersion: number }
): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGO, kekBytes(kekVersion), iv)
  cipher.setAAD(Buffer.from(`v2:${aad.orgId}:${aad.keyVersion}`))
  const data = Buffer.concat([cipher.update(dek), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v2:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`
}

export function unwrapDek(
  wrappedDek: string,
  kekVersion: number,
  aad: { orgId: string; keyVersion: number }
): Buffer {
  const parts = wrappedDek.split(":")
  const format = parts[0]
  if (parts.length !== 4 || (format !== "v1" && format !== "v2")) {
    throw new EncryptionError("INVALID_WRAPPED_DEK")
  }
  const [, ivB64, tagB64, dataB64] = parts
  if (!ivB64 || !tagB64 || dataB64 === undefined) {
    throw new EncryptionError("INVALID_WRAPPED_DEK")
  }
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  if (iv.length !== IV_LENGTH || tag.length !== 16) {
    throw new EncryptionError("INVALID_WRAPPED_DEK")
  }
  const kek = kekBytes(kekVersion)
  try {
    const decipher = createDecipheriv(AES_ALGO, kek, iv)
    if (format === "v2") {
      decipher.setAAD(Buffer.from(`v2:${aad.orgId}:${aad.keyVersion}`))
    }
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ])
  } catch {
    throw new EncryptionError("DEK_UNWRAP_FAILED")
  }
}

function parseKekVersion(value: string): number {
  const version = Number(value)
  if (!Number.isInteger(version) || version < 1) {
    throw new EncryptionError("INVALID_KEK_VERSION", value)
  }
  return version
}

export function unwrapOrgDek(row: OrgDekRow): UnwrappedOrgDek {
  return {
    ...row,
    dek: unwrapDek(row.wrappedDek, parseKekVersion(row.kekVersion), {
      orgId: row.orgId,
      keyVersion: row.keyVersion,
    }),
  }
}

function store(): OrgDekStore {
  return storeOverride ?? drizzleOrgDekStore
}

const drizzleOrgDekStore: OrgDekStore = {
  async findActive(orgId) {
    return withOrgContext(orgId, async (tx) => findActiveTx(tx, orgId))
  },
  async findByVersion(orgId, keyVersion) {
    return withOrgContext(orgId, async (tx) => {
      const [row] = await tx
        .select()
        .from(main.orgDataKeys)
        .where(
          and(
            eq(main.orgDataKeys.orgId, orgId),
            eq(main.orgDataKeys.keyVersion, keyVersion)
          )
        )
        .limit(1)
      return row
    })
  },
  async listAll(orgId) {
    return withOrgContext(orgId, async (tx) => {
      return tx
        .select()
        .from(main.orgDataKeys)
        .where(eq(main.orgDataKeys.orgId, orgId))
    })
  },
  async listOrgIdsNotWrappedWith(kekVersion, limit) {
    return withPlatformAdminContext(async (tx) => {
      const rows = await tx
        .selectDistinct({ orgId: main.orgDataKeys.orgId })
        .from(main.orgDataKeys)
        .where(ne(main.orgDataKeys.kekVersion, kekVersion))
        .orderBy(main.orgDataKeys.orgId)
        .limit(limit)
      return rows.map((row) => row.orgId)
    })
  },
  async insertIfAbsent(row) {
    return withAudit({ orgId: row.orgId }, async (tx, ctx) => {
      const existing = await findActiveTx(tx, row.orgId)
      if (existing) {
        await ctx.emit({
          entity: "org_data_key",
          action: "created",
          entityId: existing.id,
          payload: { keyVersion: existing.keyVersion, skipped: true },
        })
        return undefined
      }
      const inserted = await tx
        .insert(main.orgDataKeys)
        .values({
          orgId: row.orgId,
          keyVersion: row.keyVersion,
          kekVersion: row.kekVersion,
          wrappedDek: row.wrappedDek,
        })
        .onConflictDoNothing()
        .returning()
      const created = inserted[0]
      if (!created) {
        const raced = await findActiveTx(tx, row.orgId)
        await ctx.emit({
          entity: "org_data_key",
          action: "created",
          entityId: raced?.id ?? row.orgId,
          payload: { keyVersion: row.keyVersion, skipped: true },
        })
        return undefined
      }
      await ctx.emit({
        entity: "org_data_key",
        action: "created",
        entityId: created.id,
        payload: { keyVersion: created.keyVersion },
      })
      return created
    })
  },
  async updateWrapped(orgId, keyVersion, wrappedDek, kekVersion) {
    await withAudit({ orgId }, async (tx, ctx) => {
      const [row] = await tx
        .update(main.orgDataKeys)
        .set({ wrappedDek, kekVersion })
        .where(
          and(
            eq(main.orgDataKeys.orgId, orgId),
            eq(main.orgDataKeys.keyVersion, keyVersion)
          )
        )
        .returning({ id: main.orgDataKeys.id })
      await ctx.emit({
        entity: "org_data_key",
        action: "rotated",
        entityId: row?.id ?? orgId,
        payload: { keyVersion, kekVersion, skipped: !row },
      })
    })
  },
  async deleteAll(orgId) {
    return withAudit({ orgId }, async (tx, ctx) => {
      const rows = await tx
        .select()
        .from(main.orgDataKeys)
        .where(eq(main.orgDataKeys.orgId, orgId))
      if (rows.length > 0) {
        await tx
          .delete(main.orgDataKeys)
          .where(eq(main.orgDataKeys.orgId, orgId))
      }
      await ctx.emit({
        entity: "org_data_key",
        action: "shredded",
        entityId: orgId,
        payload: {
          keyVersions: rows.map((row) => row.keyVersion),
          shredded: rows.length,
        },
      })
      return rows
    })
  },
}

async function findActiveTx(
  tx: Tx,
  orgId: string
): Promise<OrgDekRow | undefined> {
  const [row] = await tx
    .select()
    .from(main.orgDataKeys)
    .where(
      and(eq(main.orgDataKeys.orgId, orgId), isNull(main.orgDataKeys.retiredAt))
    )
    .limit(1)
  return row
}

export async function getOrCreateOrgDek(
  orgId: string
): Promise<UnwrappedOrgDek> {
  const dekStore = store()
  const existing = await dekStore.findActive(orgId)
  if (existing) return unwrapOrgDek(existing)

  const kekVersion = currentKekVersion()
  const existingRows = await dekStore.listAll(orgId)
  let nextKeyVersion = 1
  for (const row of existingRows) {
    if (row.keyVersion >= nextKeyVersion) nextKeyVersion = row.keyVersion + 1
  }
  const dek = randomBytes(DEK_LENGTH)
  const created = await dekStore.insertIfAbsent({
    orgId,
    keyVersion: nextKeyVersion,
    kekVersion: String(kekVersion),
    wrappedDek: wrapDek(dek, kekVersion, { orgId, keyVersion: nextKeyVersion }),
  })
  if (created) return { ...created, dek }

  const raced = await dekStore.findActive(orgId)
  if (!raced) {
    throw new EncryptionError("DEK_CREATE_FAILED")
  }
  return unwrapOrgDek(raced)
}

export async function getOrgDek(
  orgId: string,
  keyVersion: number
): Promise<UnwrappedOrgDek> {
  const dekStore = store()
  const row = await dekStore.findByVersion(orgId, keyVersion)
  if (!row) {
    const remaining = await dekStore.listAll(orgId)
    throw new EncryptionError(
      remaining.length === 0 ? "KEY_SHREDDED" : "UNKNOWN_DEK_VERSION"
    )
  }
  return unwrapOrgDek(row)
}

export async function rotateKek(orgId: string): Promise<{ rewrapped: number }> {
  return rotateOrg(store(), orgId, currentKekVersion())
}

export interface RotateAllKeksResult {
  kekVersion: number
  dryRun: boolean
  /** Orgs re-wrapped, or (dry run) orgs that still need it. */
  orgs: number
  rewrapped: number
  hasMore: boolean
}

/**
 * Re-wraps every org's DEKs under the current KEK, in batches. Never
 * touches ciphertext. Idempotent: a second run finds nothing to do. Fails
 * closed if an old row's KEK is no longer loaded.
 */
export async function rotateAllOrgKeks(
  options: { dryRun?: boolean; batchSize?: number; maxOrgs?: number } = {}
): Promise<RotateAllKeksResult> {
  const dekStore = store()
  const kekVersion = currentKekVersion()
  const target = String(kekVersion)
  const batchSize = options.batchSize ?? 50
  const maxOrgs = options.maxOrgs ?? 500

  if (options.dryRun) {
    const pending = await dekStore.listOrgIdsNotWrappedWith(target, maxOrgs + 1)
    return {
      kekVersion,
      dryRun: true,
      orgs: Math.min(pending.length, maxOrgs),
      rewrapped: 0,
      hasMore: pending.length > maxOrgs,
    }
  }

  let orgs = 0
  let rewrapped = 0
  while (orgs < maxOrgs) {
    const orgIds = await dekStore.listOrgIdsNotWrappedWith(
      target,
      Math.min(batchSize, maxOrgs - orgs)
    )
    if (orgIds.length === 0) {
      return { kekVersion, dryRun: false, orgs, rewrapped, hasMore: false }
    }
    for (const orgId of orgIds) {
      rewrapped += (await rotateOrg(dekStore, orgId, kekVersion)).rewrapped
      orgs += 1
    }
  }
  const remaining = await dekStore.listOrgIdsNotWrappedWith(target, 1)
  return {
    kekVersion,
    dryRun: false,
    orgs,
    rewrapped,
    hasMore: remaining.length > 0,
  }
}

async function rotateOrg(
  dekStore: OrgDekStore,
  orgId: string,
  nextVersion: number
): Promise<{ rewrapped: number }> {
  const rows = await dekStore.listAll(orgId)
  let rewrapped = 0
  for (const row of rows) {
    if (parseKekVersion(row.kekVersion) === nextVersion) continue
    const aad = { orgId, keyVersion: row.keyVersion }
    const dek = unwrapDek(row.wrappedDek, parseKekVersion(row.kekVersion), aad)
    await dekStore.updateWrapped(
      orgId,
      row.keyVersion,
      wrapDek(dek, nextVersion, aad),
      String(nextVersion)
    )
    rewrapped += 1
  }
  return { rewrapped }
}

export async function shredOrgKeys(
  orgId: string
): Promise<{ shredded: number }> {
  const rows = await store().deleteAll(orgId)
  return { shredded: rows.length }
}

export function createMemoryOrgDekStore(): OrgDekStore {
  const rows = new Map<string, OrgDekRow>()
  const keyOf = (orgId: string, keyVersion: number) => `${orgId}:${keyVersion}`

  return {
    async findActive(orgId) {
      for (const row of rows.values()) {
        if (row.orgId === orgId && row.retiredAt == null) return row
      }
      return undefined
    },
    async findByVersion(orgId, keyVersion) {
      return rows.get(keyOf(orgId, keyVersion))
    },
    async listAll(orgId) {
      return [...rows.values()].filter((row) => row.orgId === orgId)
    },
    async listOrgIdsNotWrappedWith(kekVersion, limit) {
      const orgIds = new Set<string>()
      for (const row of rows.values()) {
        if (row.kekVersion !== kekVersion) orgIds.add(row.orgId)
      }
      return [...orgIds].sort().slice(0, limit)
    },
    async insertIfAbsent(row) {
      for (const existing of rows.values()) {
        if (existing.orgId === row.orgId && existing.retiredAt == null) {
          return undefined
        }
      }
      const key = keyOf(row.orgId, row.keyVersion)
      if (rows.has(key)) return undefined
      const created: OrgDekRow = {
        id: crypto.randomUUID(),
        orgId: row.orgId,
        keyVersion: row.keyVersion,
        kekVersion: row.kekVersion,
        wrappedDek: row.wrappedDek,
        retiredAt: null,
      }
      rows.set(key, created)
      return created
    },
    async updateWrapped(orgId, keyVersion, wrappedDek, kekVersion) {
      const existing = rows.get(keyOf(orgId, keyVersion))
      if (!existing) return
      rows.set(keyOf(orgId, keyVersion), {
        ...existing,
        wrappedDek,
        kekVersion,
      })
    },
    async deleteAll(orgId) {
      const deleted: OrgDekRow[] = []
      for (const [key, row] of rows) {
        if (row.orgId === orgId) {
          deleted.push(row)
          rows.delete(key)
        }
      }
      return deleted
    },
  }
}
