/* eslint-disable turbo/no-undeclared-env-vars -- script-only env, see README */
/**
 * One-off: copy objects from the old Vercel Blob stores to R2 and rewrite the
 * references to them (ADR-025). Dry run unless `--apply` is passed.
 *
 *   pnpm --filter @eleva/infra-storage migrate:blob-to-r2
 *   pnpm --filter @eleva/infra-storage migrate:blob-to-r2 --apply
 *
 * See README.md for the env vars and the run order.
 */

import { mediaBaseUrl, mediaUrl } from "@eleva/config/media-host"
import { auth, main as schema, withPlatformAdminContext } from "@eleva/db"
import { listMediaEntries } from "@eleva/media"
import {
  headPrivateDocument,
  headPublicObject,
  uploadPrivateObject,
  uploadPublicObject,
} from "@eleva/storage"
import { eq, isNotNull, like } from "drizzle-orm"

import { createLegacyBlobStore } from "./legacy-blob-store"
import {
  migrate,
  type PrivateReference,
  type PublicReference,
  type References,
  type TargetStore,
} from "./migrate"

const LEGACY_URL_PATTERN = "%.blob.vercel-storage.com/%"

const targetStore: TargetStore = {
  hasPublic: async (key) => (await headPublicObject(key)) !== null,
  hasPrivate: async (key) => (await headPrivateDocument(key)) !== null,
  async writePublic(key, object) {
    await uploadPublicObject({ pathname: key, ...object, overwrite: true })
  },
  async writePrivate(key, object) {
    await uploadPrivateObject({ pathname: key, ...object, overwrite: true })
  },
}

const references: References = {
  async publicReferences() {
    return withPlatformAdminContext(async (tx) => {
      const [users, experts, clinics] = await Promise.all([
        tx
          .select({ id: auth.user.id, url: auth.user.image })
          .from(auth.user)
          .where(like(auth.user.image, LEGACY_URL_PATTERN)),
        tx
          .select({
            id: schema.expertProfiles.id,
            url: schema.expertProfiles.avatarUrl,
          })
          .from(schema.expertProfiles)
          .where(like(schema.expertProfiles.avatarUrl, LEGACY_URL_PATTERN)),
        tx
          .select({
            id: schema.clinicProfiles.id,
            url: schema.clinicProfiles.logoUrl,
          })
          .from(schema.clinicProfiles)
          .where(like(schema.clinicProfiles.logoUrl, LEGACY_URL_PATTERN)),
      ])
      const tag = (table: string, rows: { id: string; url: string | null }[]) =>
        rows.flatMap((row): PublicReference[] =>
          row.url ? [{ table, id: row.id, url: row.url }] : []
        )
      return [
        ...tag("auth.user.image", users),
        ...tag("expert_profiles.avatar_url", experts),
        ...tag("clinic_profiles.logo_url", clinics),
      ]
    })
  },
  async privateReferences() {
    return withPlatformAdminContext(async (tx) => {
      const [dsars, documents] = await Promise.all([
        tx
          .select({
            id: schema.dsarRequests.id,
            value: schema.dsarRequests.blobPathname,
          })
          .from(schema.dsarRequests)
          .where(isNotNull(schema.dsarRequests.blobPathname)),
        tx
          .select({
            id: schema.sessionDocuments.id,
            value: schema.sessionDocuments.blobUrl,
          })
          .from(schema.sessionDocuments)
          .where(like(schema.sessionDocuments.blobUrl, LEGACY_URL_PATTERN)),
      ])
      return [
        ...dsars.flatMap((row): PrivateReference[] =>
          row.value
            ? [
                {
                  table: "dsar_requests.blob_pathname",
                  id: row.id,
                  value: row.value,
                },
              ]
            : []
        ),
        ...documents.map(
          (row): PrivateReference => ({
            table: "session_documents",
            id: row.id,
            value: row.value,
          })
        ),
      ]
    })
  },
  async rewritePublic(reference, url) {
    await withPlatformAdminContext(async (tx) => {
      if (reference.table === "auth.user.image") {
        await tx
          .update(auth.user)
          .set({ image: url })
          .where(eq(auth.user.id, reference.id))
      } else if (reference.table === "expert_profiles.avatar_url") {
        await tx
          .update(schema.expertProfiles)
          .set({ avatarUrl: url })
          .where(eq(schema.expertProfiles.id, reference.id))
      } else {
        await tx
          .update(schema.clinicProfiles)
          .set({ logoUrl: url })
          .where(eq(schema.clinicProfiles.id, reference.id))
      }
    })
  },
  async rewritePrivate(reference, key) {
    await withPlatformAdminContext(async (tx) => {
      if (reference.table === "session_documents") {
        await tx
          .update(schema.sessionDocuments)
          .set({ blobPathname: key, blobUrl: key })
          .where(eq(schema.sessionDocuments.id, reference.id))
      } else {
        await tx
          .update(schema.dsarRequests)
          .set({ blobPathname: key })
          .where(eq(schema.dsarRequests.id, reference.id))
      }
    })
  },
}

async function run() {
  const apply = process.argv.includes("--apply")
  if (!mediaBaseUrl()) throw new Error("R2_PUBLIC_BASE_URL is required")

  const libraryKeys = listMediaEntries().flatMap((entry) =>
    entry.kind === "image"
      ? [entry.key]
      : [entry.key, entry.posterKey, ...(entry.webmKey ? [entry.webmKey] : [])]
  )

  const report = await migrate({
    apply,
    legacy: createLegacyBlobStore({
      publicToken: process.env.BLOB_READ_WRITE_TOKEN,
      privateToken: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN,
    }),
    target: targetStore,
    references,
    libraryKeys,
    publicUrl: mediaUrl,
  })
  console.log(JSON.stringify(report, null, 2))
  if (!report.mediaListed) {
    console.warn(
      "[blob-to-r2] BLOB_READ_WRITE_TOKEN not set: copied library.json keys only"
    )
  }
  if (!apply) console.log("[blob-to-r2] dry run: pass --apply to write")
}

run().catch((err: unknown) => {
  console.error(
    "[blob-to-r2] failed:",
    err instanceof Error ? err.message : err
  )
  process.exitCode = 1
})
