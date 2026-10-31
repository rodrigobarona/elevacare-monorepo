# ADR-025: Cloudflare R2 is the only object store

## Status

Accepted (founder decision, 2026-10-31). Amends ADR-024. Leaves D-08 open, see below.

## Date

2026-10-31

## Context

The production Vercel team (Enterprise) has no Vercel Blob and will not get it, so
`@eleva/storage` needs another backend. Production holds very little today: one
`auth.user.image` row, 13 `dsar_requests` rows, no `session_documents` rows, and the marketing
media library.

## Decision

1. **R2 only.** `@eleva/storage` talks to Cloudflare R2 over the S3 API (`@aws-sdk/client-s3`).
   `@vercel/blob` is removed. Boundary lint forbids the AWS SDK outside `@eleva/storage`.
2. **Two EU jurisdiction buckets, separate credentials.** Each bucket has its own bucket-scoped
   token, so a leaked public key can never read health data. The endpoint is
   `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`, region `auto`. A bucket's jurisdiction
   cannot change after creation. Health and member documents only ever go to the private bucket.
3. **Browser uploads use a 5-minute presigned PUT.** The API repeats the same auth, pathname and
   MIME checks as before, adds a random suffix and signs `Content-Type` and `If-None-Match: *`. A
   different type fails, and a URL cannot be replayed over an object that has passed review.
4. **Verification sits in the route that records the object.** It replaces Blob's upload-completed
   callback: HEAD, check size and type, delete the object if it breaks the limit. R2 does not
   document enforcement of a signed `Content-Length`, so the size sent when presigning is only an
   early rejection. A separate "complete" endpoint was rejected because a caller could skip it
   and go straight to `PUT /users/avatar`.
5. **Private reads stream through the API**, so access control stays in our code. A browser never
   gets a private presigned GET.
6. **Public URLs are `R2_PUBLIC_BASE_URL` + key.** One helper, `@eleva/config/media-host`, feeds
   object URLs, CSP, `next/image` patterns and the portrait and avatar checks. `library.json`
   stores keys, so a host change is one env var. Frontends read the same value from
   `NEXT_PUBLIC_MEDIA_BASE_URL`. `r2.dev` is rate-limited and non-production, and the helper
   refuses it when `VERCEL_ENV=production`.
7. **No schema change.** `blob_pathname` and `blob_url` keep their names and now hold the key. A
   rename is a follow-up.
8. **Migration** is a one-off dry-run-by-default script, `infra/storage/migrate-blob-to-r2.ts`.

### Media domain

An R2 custom domain must be a zone in the same Cloudflare account as the bucket. `eleva.care` DNS
stays on Vercel, and Cloudflare's partial (CNAME) setup needs the Business plan, so the media host
is a **separate domain on Cloudflare**. That also makes it cookie-free. The domain is not chosen
yet.

### Why not Neon Object Storage

It is in beta with no published pricing, which is not a basis for health data at launch.

### Video

Marketing video stays progressive WebM + MP4 (ADR-024), hosted on R2. HLS is not built.

Academy direction, **not built**: ffmpeg offline to an HLS ladder, stored in R2, served from the
custom domain with Cache Everything and Smart Tiered Cache, played with `hls-video-element`, with
no third-party analytics. Paid lessons need WAF HMAC token auth (Pro plan or higher), because
presigned URLs do not work on custom domains. Expert self-upload would need a transcoding worker.

Cloudflare's CDN terms require a paid service for video unless on Enterprise and name the Developer
Platform as an example. R2 is sold under the Developer Platform.

## Consequences

- R2 serves media on a host Eleva controls, and moving it later is one env var plus a rebuild,
  because `images.remotePatterns` and `NEXT_PUBLIC_MEDIA_BASE_URL` are read at build time.
- Each bucket needs a CORS rule for browser PUTs.
- Cloudflare becomes a sub-processor for session documents. Its DPA must be accepted in the
  company's name before real documents land.
- An upload that is never recorded leaves an orphan object, as it did on Blob. The public bucket
  serves that object until it is removed, and its size is not limited at the edge. A sweep is a
  follow-up (decision log, 2026-10-31).

## Open items

- **D-08 needs its wording revisited.** It names the "private Blob store" as the system of record
  for recordings and still stands on one fact: Daily recording cannot write directly to R2, Blob
  or Neon. This ADR does not change D-08. Its owners should restate the destination before Phase
  16.8.
