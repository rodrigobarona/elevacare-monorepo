# @eleva/storage

`@eleva/storage` owns all object storage for the monorepo: Cloudflare R2 over the
S3 API (ADR-025). Apps and API routes must not import `@aws-sdk/*` directly.

## Buckets

Two EU jurisdiction buckets, each with its own bucket-scoped credentials.

| Bucket  | Env            | Use for                               |
| ------- | -------------- | ------------------------------------- |
| Public  | `R2_PUBLIC_*`  | Avatars, marketing assets             |
| Private | `R2_PRIVATE_*` | Expert documents, member reports, PHI |

Never store member data, health reports, expert documents, or other PHI in the
public bucket.

## Public Avatar Upload Flow

Account profile avatars upload straight from the browser to R2:

1. `apps/account/src/app/account/(shell)/settings/avatar-upload.tsx` asks the
   Server Action for a short-lived upload token.
2. `getAvatarUploadToken()` mints a scoped `storage-upload` token with the app
   user ID.
3. `uploadFile()` posts to `NEXT_PUBLIC_API_URL/storage/upload`.
4. `apps/api/src/app/storage/upload/route.ts` validates the token, pathname,
   content type, and declared size, then `createUploadUrl()` presigns a PUT for
   5 minutes.
5. The browser PUTs the file directly to the public bucket.
6. The account Server Action calls `PUT /users/avatar` through
   `@eleva/api-client`, forwarding the current session cookie.
7. `apps/api/src/app/users/avatar/route.ts` checks the stored object's size and
   type, persists the public URL in `auth.user.image` and deletes the replaced
   object after the DB write.

Step 7 is the real size limit. Presigning signs the type, not the length, so any
route that records an object must call `isVerifiedPublicUpload()` or
`verifyUpload()` first. `Content-Type` and `If-None-Match: *` are signed: a
different type fails and a URL cannot overwrite an object already reviewed.

Each bucket needs a CORS rule allowing `PUT` with `Content-Type` and
`If-None-Match` from the app origins.

The upload token is only for `/storage/upload`. It must not authenticate regular
profile API calls such as `GET`, `PUT`, or `DELETE /users/avatar`; those routes
use the standard API auth model (`requireApiAuth()`).

## Avatar Source Of Truth

An identity provider may expose an OAuth profile picture for identities created
through an external provider. Treat that value as provider-owned identity data,
not the Eleva app avatar.

The canonical app avatar is `auth.user.image` in `@eleva/db` because it is:

- controlled by the account profile flow;
- exposed through the API-first contract at `/users/avatar`;
- resolved into `ElevaSession.user.avatarUrl` by `@eleva/auth`;
- auditable with the rest of Eleva's mutating user operations.

Do not store the app avatar in user metadata. Metadata would bypass the
domain package and audit patterns, make OpenAPI documentation less useful, and
couple app-specific profile state to the identity provider.

## Private Documents

Use `uploadPrivateObject()`, `deletePrivateDocument()`, `headPrivateDocument()`
and `getPrivateDocument()` for private objects, addressed by key. API routes
that stream private objects must authenticate and authorize the caller first. A
browser never gets a private presigned URL for reading.

`blob_pathname` and `blob_url` columns hold the R2 key.

## Testing

`pnpm --filter @eleva/storage test` runs the unit tests.
`src/r2.integration.test.ts` exercises the real wire protocol and is skipped
unless `R2_INTEGRATION=1`. Point it at MinIO with `R2_ENDPOINT`, or leave that
unset with real `R2_*` vars to prove the same behaviour on R2. Add
`R2_INTEGRATION_ORIGIN` to check the bucket CORS rule.
