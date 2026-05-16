# @eleva/auth

Authentication, session management, and authorization for the Eleva v3
monorepo. Built on [WorkOS AuthKit](https://workos.com/docs/user-management)
with Next.js App Router integration.

## JWT / session architecture

This package does **not** depend on `jose` or any other JWT library directly.
All JWT operations are handled internally by the WorkOS SDK stack:

| Concern                 | Handled by                                          | How                                                                                                                                                      |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT verification (JWKS) | `@workos-inc/authkit-session` → `jose` (transitive) | `AuthKitCore.verifyToken()` calls `jwtVerify()` + `createRemoteJWKSet()` against the WorkOS JWKS endpoint. Keys are cached per process and auto-rotated. |
| Token claim parsing     | `@workos-inc/authkit-session`                       | `AuthKitCore.parseTokenClaims()` decodes claims without signature verification (useful for reading `org_id`, `role`, `exp`).                             |
| Token refresh           | `@workos-inc/authkit-nextjs` middleware             | Automatically calls `authenticateWithRefreshToken()` when the access token expires, then re-encrypts the session cookie.                                 |
| Session encryption      | `iron-session` (`sealData` / `unsealData`)          | AES-256-CBC + SHA-256 HMAC. Keyed by `WORKOS_COOKIE_PASSWORD`.                                                                                           |
| PKCE OAuth flow         | `@workos-inc/authkit-nextjs`                        | Built-in PKCE support for the authorization code flow.                                                                                                   |

### Why `jose` was removed (May 2026)

`jose` was listed as a direct dependency but never imported by any first-party
code. The WorkOS SDK bundles `jose` as a transitive dependency inside
`@workos-inc/authkit-session`, which is itself a dependency of
`@workos-inc/authkit-nextjs`. Keeping `jose` as a direct dependency added
unnecessary weight and a second version to maintain. Removing it has zero
runtime impact since all JWT operations go through the WorkOS SDK.

## Owner

Implementation plan in `docs/eleva-v3/implementation-sprints.md`.
