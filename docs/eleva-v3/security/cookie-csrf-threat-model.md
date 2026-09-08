# Cookie, CSRF, and subdomain threat model (D-13)

Status: **proposed** (engineering). Security owner sign-off is a Phase 4 PR 04.2
entry gate — do not treat this file as approved.

Owner: security  
Review date: 2026-10-01

## Cookie attributes

Product-app Better Auth session cookies:

| Attribute   | Value                                              | Why                                                  |
| ----------- | -------------------------------------------------- | ---------------------------------------------------- |
| `Domain`    | `.eleva.care` (staging `.dev.eleva.care`)          | Shared session across gateway zones                  |
| `Secure`    | yes                                                | HTTPS only                                           |
| `HttpOnly`  | yes                                                | No `document.cookie` access                          |
| `SameSite`  | `Lax`                                              | Blocks cross-site POST cookies; allows top-level GET |
| Name prefix | `__Secure-better-auth.session_token` in production | Browser refuses non-Secure cookies with that prefix  |

`admin.eleva.care` (Phase 12) uses a host-only `__Host-` cookie and rejects the
shared `.eleva.care` cookie. Previews never mint `.eleva.care` cookies.

`__Secure-` does **not** stop cookie tossing: a sibling subdomain can still set
a second cookie with the same name. The signed value is the source of truth;
duplicate names are rejected.

## CSRF

Cookie-authenticated mutations (`requireApiAuth` cookie path only) require:

- `Sec-Fetch-Site` is not `cross-site`, and
- if `Origin` is present, it is on the explicit `trustedOrigins()` list
  (`ELEVA_TRUSTED_ORIGINS` plus the hardcoded production/staging/localhost
  origins — never `*`).

Failure: **403 `CSRF_ORIGIN_MISMATCH`**.

Bearer session tokens, JWTs, and `x-api-key` are exempt (no ambient cookie).

## Cookie tossing

If the request `Cookie` header contains more than one value for
`better-auth.session_token` or `__Secure-better-auth.session_token`:

- **401 `SESSION_COOKIE_AMBIGUOUS`**
- both cookies are cleared (`Set-Cookie` Max-Age=0 on the parent domain and host)
- a security log line is written

Tests: `packages/auth/src/server/api-auth.test.ts` and
`packages/auth/src/server/csrf.test.ts` (six cases: same-site cookie POST,
cross-site cookie POST, untrusted Origin, Bearer cross-site, API-key
cross-site, duplicate session cookie).

## DNS inventory

See `docs/eleva-v3/environment-matrix.md` for the `*.eleva.care` host list.
Every extra hostname that can set a Domain-scoped cookie is in scope for this
model.
