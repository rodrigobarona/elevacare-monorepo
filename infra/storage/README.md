# @eleva/infra-storage

One-off migration from the old Vercel Blob stores to Cloudflare R2 (ADR-025).
Delete this package once production has been migrated and the old stores are
closed.

`migrate-blob-to-r2.ts` is a **dry run by default** and idempotent, so a failed
run can be repeated. `--apply` is the only switch that writes. `--apply
--copy-only` copies objects and leaves references alone, so files are on R2
before the new code deploys. Run `--apply` after the deploy to rewrite them.

It covers:

| Source                                                   | Copied to | Reference                                |
| -------------------------------------------------------- | --------- | ---------------------------------------- |
| Every key under `media/`, plus all `library.json` keys   | Public    | None: `library.json` already stores keys |
| `auth.user.image`                                        | Public    | Rewritten to `R2_PUBLIC_BASE_URL` + key  |
| `expert_profiles.avatar_url`, `clinic_profiles.logo_url` | Public    | Rewritten to `R2_PUBLIC_BASE_URL` + key  |
| `dsar_requests.blob_pathname`                            | Private   | Rewritten to the key                     |
| `session_documents` rows still holding a Blob URL        | Private   | Both columns rewritten to the key        |

A public URL whose object is gone stays as it is and is reported. A private row
is always rewritten to a key, so expiry and retention still address it.

## How old objects are read

No `@vercel/blob` dependency. Objects are read with plain HTTP:

- **Public:** `GET https://<store>.public.blob.vercel-storage.com/<key>`.
- **Private:** the same URL on `<store>.private.blob.vercel-storage.com` with
  `Authorization: Bearer <BLOB_PRIVATE_READ_WRITE_TOKEN>`. The store id is the
  fourth `_` segment of the token. This is what `@vercel/blob` 2.3.3 `get()` does.
- **Listing `media/`:** `GET https://vercel.com/api/blob?prefix=media/` with
  `Authorization: Bearer <BLOB_READ_WRITE_TOKEN>` and `x-api-version: 12`.

The token never leaves those hosts: URLs are rebuilt from the key, not taken
from a database row.

## Env

Pass these to this script only. They are not part of the app env.

| Var                             | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`         | Lists `media/`; without it only `library.json` keys |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` | Reads private objects                               |
| `DATABASE_URL`                  | Target database                                     |
| `R2_*`, `R2_PUBLIC_BASE_URL`    | Target buckets and public host                      |

## Run order

1. Create the buckets, tokens, CORS rules and media domain.
2. Prove R2 with `R2_INTEGRATION=1` (`packages/storage/README.md`).
3. Dry run. Read `missing` and the counts in the JSON report.
4. Deploy the release, then run with `--apply`. Run it once more to confirm it
   reports nothing left to copy or rewrite.

Row rewrites are not written to `audit_events`: this changes where an object is
stored, not who it belongs to. Keep the JSON report as the record. It holds row
ids and counts, never file names or tokens.

Never run this against production without the founder's go-ahead.
