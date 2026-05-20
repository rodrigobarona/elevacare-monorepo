# @eleva/storage

`@eleva/storage` owns all Vercel Blob access for the monorepo. Apps and API
routes must not import `@vercel/blob` or `@vercel/blob/client` directly.

## Blob Stores

| Store   | Env var                         | Access              | Use for                                |
| ------- | ------------------------------- | ------------------- | -------------------------------------- |
| Public  | `BLOB_READ_WRITE_TOKEN`         | `access: "public"`  | Avatars, marketing assets              |
| Private | `BLOB_PRIVATE_READ_WRITE_TOKEN` | `access: "private"` | Expert documents, patient reports, PHI |

Never store patient data, health reports, expert documents, or other PHI in the
public store.

## Public Avatar Upload Flow

Account profile avatars use Vercel Blob client uploads:

1. `apps/account/src/app/account/profile/avatar-upload.tsx` asks the Server
   Action for a short-lived upload token.
2. `getAvatarUploadToken()` in
   `apps/account/src/app/account/profile/actions.ts` mints a scoped
   `blob-upload` token with the app user ID.
3. `uploadBlobClient()` posts to `NEXT_PUBLIC_API_URL/blob/upload`.
4. `apps/api/src/app/blob/upload/route.ts` validates the token, pathname,
   content type, and size before `handleBlobUpload()` mints the Vercel Blob
   client token.
5. The browser uploads the file directly to the public Blob store.
6. The account Server Action calls `PUT /users/avatar` through
   `@eleva/api-client`, forwarding the current session cookie.
7. `apps/api/src/app/users/avatar/route.ts` persists the final public Blob URL
   in `main.users.avatarUrl` and deletes the replaced blob after the DB write.

The upload token is only for `/blob/upload`. It must not authenticate regular
profile API calls such as `GET`, `PUT`, or `DELETE /users/avatar`; those routes
use the standard API auth model (`requireApiAuth()`).

## Avatar Source Of Truth

WorkOS may expose an OAuth profile picture for identities created through an
external provider. Treat that value as provider-owned identity data, not the
Eleva app avatar.

The canonical app avatar is `main.users.avatarUrl` in `@eleva/db` because it is:

- controlled by the account profile flow;
- exposed through the API-first contract at `/users/avatar`;
- resolved into `ElevaSession.user.avatarUrl` by `@eleva/auth`;
- auditable with the rest of Eleva's mutating user operations.

Do not store the app avatar in WorkOS user metadata. Metadata would bypass the
domain package and audit patterns, make OpenAPI documentation less useful, and
couple app-specific profile state to the identity provider.

## Private Documents

Use `uploadPrivateDocument()`, `deletePrivateDocument()`, and
`getPrivateDocument()` for private blobs. API routes that stream private blobs
must authenticate and authorize the caller before reading from Blob storage.
