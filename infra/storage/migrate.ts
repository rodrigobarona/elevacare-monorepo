/**
 * Copy logic for the one-off Vercel Blob to R2 migration. All I/O is injected
 * so a dry run, a test and `--apply` follow the same path.
 *
 * Idempotent: objects already in R2 are not copied again and references
 * already rewritten are skipped, so a failed run can simply be repeated.
 */

const LEGACY_HOST_SUFFIX = ".blob.vercel-storage.com"

export interface LegacyObject {
  body: Buffer
  contentType: string
}

export interface LegacyStore {
  /** Every key under `media/`, or null when the store cannot be listed. */
  listMediaKeys(): Promise<string[] | null>
  readPublic(key: string): Promise<LegacyObject | null>
  readPrivate(key: string): Promise<LegacyObject | null>
}

export interface TargetStore {
  hasPublic(key: string): Promise<boolean>
  hasPrivate(key: string): Promise<boolean>
  writePublic(key: string, object: LegacyObject): Promise<void>
  writePrivate(key: string, object: LegacyObject): Promise<void>
}

export interface PublicReference {
  table: string
  id: string
  url: string
}

export interface PrivateReference {
  table: string
  id: string
  /** Column read by storage calls: a key, or a Blob URL on older rows. */
  value: string
}

export interface References {
  publicReferences(): Promise<PublicReference[]>
  privateReferences(): Promise<PrivateReference[]>
  rewritePublic(reference: PublicReference, url: string): Promise<void>
  rewritePrivate(reference: PrivateReference, key: string): Promise<void>
}

export interface MigrationReport {
  apply: boolean
  mediaListed: boolean
  copied: { public: number; private: number }
  alreadyCopied: { public: number; private: number }
  rewritten: { public: number; private: number }
  /** Gone from the old store and not in R2: row ids, or `media` keys. */
  missing: { table: string; id: string }[]
}

export function isLegacyBlobUrl(value: string): boolean {
  try {
    return new URL(value).hostname.endsWith(LEGACY_HOST_SUFFIX)
  } catch {
    return false
  }
}

/** `blob_pathname` holds a bare key or, on older rows, a full Blob URL. */
export function legacyKey(value: string): string {
  return isLegacyBlobUrl(value)
    ? decodeURIComponent(new URL(value).pathname.slice(1))
    : value
}

export async function migrate(input: {
  apply: boolean
  /** Copy objects but leave database references for a later run. */
  copyOnly?: boolean
  legacy: LegacyStore
  target: TargetStore
  references: References
  libraryKeys: readonly string[]
  publicUrl: (key: string) => string
}): Promise<MigrationReport> {
  const { apply, legacy, target, references, publicUrl } = input
  const rewrite = apply && !input.copyOnly
  const report: MigrationReport = {
    apply,
    mediaListed: false,
    copied: { public: 0, private: 0 },
    alreadyCopied: { public: 0, private: 0 },
    rewritten: { public: 0, private: 0 },
    missing: [],
  }

  async function copy(
    store: "public" | "private",
    key: string
  ): Promise<boolean> {
    const has = store === "public" ? target.hasPublic : target.hasPrivate
    if (await has(key)) {
      report.alreadyCopied[store] += 1
      return true
    }
    const read = store === "public" ? legacy.readPublic : legacy.readPrivate
    const object = await read(key)
    if (!object) return false
    if (apply) {
      const write =
        store === "public" ? target.writePublic : target.writePrivate
      await write(key, object)
    }
    report.copied[store] += 1
    return true
  }

  const listed = await legacy.listMediaKeys()
  report.mediaListed = listed !== null
  const mediaKeys = new Set([...input.libraryKeys, ...(listed ?? [])])
  for (const key of mediaKeys) {
    if (!(await copy("public", key))) {
      report.missing.push({ table: "media", id: key })
    }
  }

  for (const reference of await references.publicReferences()) {
    if (!isLegacyBlobUrl(reference.url)) continue
    const key = legacyKey(reference.url)
    if (!(await copy("public", key))) {
      report.missing.push({ table: reference.table, id: reference.id })
      continue
    }
    if (input.copyOnly) continue
    if (rewrite) await references.rewritePublic(reference, publicUrl(key))
    report.rewritten.public += 1
  }

  for (const reference of await references.privateReferences()) {
    const key = legacyKey(reference.value)
    const copied = await copy("private", key)
    if (!copied) {
      report.missing.push({ table: reference.table, id: reference.id })
    }
    // A dead URL still becomes a key: expiry and retention address rows by key.
    if (reference.value !== key && !input.copyOnly) {
      if (rewrite) await references.rewritePrivate(reference, key)
      report.rewritten.private += 1
    }
  }

  return report
}
