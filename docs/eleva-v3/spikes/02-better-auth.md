# Spike 02.0 — Better Auth 1.7.3

**Status:** 12 proven, 1 plan-change (Google implicit linking — ADR-017,
not a vendor gap). Passkey attestation is deferred to 02.2 Playwright.
**Date:** 2026-09-08
**Neon:** project `raspy-mouse-18304810`, branch `spike-02-better-auth`
(`br-falling-rice-al22njla`), database `auth_spike` (empty public schema;
not `neondb`).
**Instance:** throwaway Node server via `toNodeHandler` in
`packages/auth/spikes/` (deleted before PR 02.1).
**Raw captures:** `packages/auth/spikes/evidence.json`

## Versions to pin in PR 02.1

| Package                        | Version         | Import                                                                                                                                                                                             |
| ------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-auth`                  | **1.7.3**       | `betterAuth`, `better-auth/plugins`, `better-auth/node`, `better-auth/next-js`, `better-auth/db/migration`                                                                                         |
| `@better-auth/passkey`         | **1.7.3**       | `passkey` — **not** `better-auth/plugins`                                                                                                                                                          |
| `@better-auth/api-key`         | **1.7.3**       | `apiKey` — **not** `better-auth/plugins`                                                                                                                                                           |
| `@better-auth/drizzle-adapter` | **1.7.3**       | `drizzleAdapter` — **not** `better-auth/adapters/drizzle`                                                                                                                                          |
| `@better-auth/stripe`          | —               | do not add                                                                                                                                                                                         |
| `@better-auth/cli`             | 1.4.22 (lagged) | do not use for 1.7 Drizzle schema. Spike used Kysely `getMigrations` only because the throwaway instance used `pg.Pool`. 02.1 authors Drizzle tables from the list below + `drizzle-kit generate`. |

Still inside `better-auth/plugins` at 1.7.3: `organization`, `admin`,
`twoFactor`, `magicLink`, `bearer`, `jwt`, `openAPI`.
`nextCookies` is `better-auth/next-js` and must stay last.

## Contract checks

Each row is `better-auth@1.7.3`. Bodies are redacted; full JSON is in
`evidence.json`.

### 01 — Sign-up + email verification — proven

- **Request:** `POST /auth/sign-up/email` `{ name, email, password }` with
  `Origin: http://127.0.0.1:8787`. Token from `sendVerificationEmail`.
  `GET /auth/verify-email?token=…`.
- **Response:** sign-up 200, `token: null` (verification required). Verify
  302 + session cookie. `GET /auth/get-session` 200,
  `emailVerified: true`, user id UUID
  (`advanced.database.generateId: "uuid"`).
- **Absorb:** none. `requireEmailVerification` +
  `autoSignInAfterVerification` behave as the phase file states.
  POSTs without `Origin` are rejected (CSRF) — the prove client must send
  `Origin`.

### 02 — Personal Space provisioning hook — proven

- **Request:** `databaseHooks.user.create.after` →
  `auth.api.createOrganization({ body: { name: "${firstName}'s Space",
slug, userId, type: "personal" } })`.
- **Response:** `GET /auth/organization/list` 200:
  `{ name: "Rodrigo's Space", type: "personal", slug: "space-…" }`.
- **Absorb:** list is **GET** `/auth/organization/list`, not POST. Hook
  may use `userId` (no session headers). Name is first name only +
  `'s Space`.
- **Unproven:** `withAudit` / `audit_outbox`. The throwaway `auth_spike`
  database has no audit tables; wrapping `@eleva/audit` would couple the
  isolated spike to the main Neon database. 02.1 wraps this hook in
  `withAudit`.

### 03 — Expert organization creation — proven

- **Request:** `POST /auth/organization/create`
  `{ name, slug, type: "expert" }`.
- **Response:** 200, `type: "expert"`, creator `role: "owner"`.
- **Absorb:** `additionalFields.type` is a real column on `organization`
  (migration `toBeCreated`). `creatorRole: "owner"` is honoured.

### 04 — Organization switching — proven

- **Request:** `POST /auth/organization/set-active`
  `{ organizationId }`.
- **Response:** 200. `GET /auth/get-session` →
  `session.activeOrganizationId` equals that id.
- **Absorb:** none. Session column is `activeOrganizationId`.

### 05 — Cross-subdomain cookie `*.dev.eleva.care` — proven (header)

- **Request:** `advanced.crossSubDomainCookies.enabled` +
  `domain: ".dev.eleva.care"`, `useSecureCookies: false` (localhost).
- **Response:**
  `Set-Cookie: better-auth.session_token=…; Max-Age=2592000;
Domain=.dev.eleva.care; Path=/; HttpOnly; SameSite=Lax`.
- **Absorb:** cookie **name** is `better-auth.session_token`. The
  `__Secure-` prefix appears only when `useSecureCookies: true`
  (production / staging HTTPS). Live browser proof on a real
  `*.dev.eleva.care` host is 02.2 / staging, not this process.

### 06 — Passkey + TOTP enrol and verify — proven (TOTP full; passkey options)

- **Request:** `POST /auth/two-factor/enable` `{ password }` →
  `POST /auth/two-factor/verify-totp` `{ code }` from `otpauth` parsing
  `totpURI`. `GET /auth/passkey/generate-register-options`.
- **Response:** enable 200, 10 backup codes, TOTP verify 200. Passkey
  options 200 (`rp.id`, challenge, `pubKeyCredParams`).
- **Absorb:** finish passkey **attestation** in 02.2 with Playwright’s
  virtual authenticator. Import passkey from `@better-auth/passkey`.

### 07 — API key create + authenticate — proven

- **Request:** `POST /auth/api-key/create` `{ name, metadata }`.
  `GET /auth/get-session` with `x-api-key`.
- **Response:** create 200 (key shown once). Session 200 without a
  cookie.
- **Absorb:** import `@better-auth/api-key`. Never accept an API key as
  `Authorization: Bearer` (phase file already says this).

### 08 — Opaque bearer session token — proven

- **Request:** `POST /auth/sign-in/email` → body `token`.
  `GET /auth/get-session` `Authorization: Bearer <token>` (no cookie).
- **Response:** 200, same user id. Token is opaque (not three JWS
  segments).
- **Absorb:** none. `bearer()` is the session-token verifier.

### 09 — JWT + JWKS from a second process — proven

- **Request:** `GET /auth/token` (cookie session). Child process
  `verify-jwt.ts` (`jose.jwtVerify` + `createRemoteJWKSet(/auth/jwks)`).
- **Response:** child exit 0. Header `alg: EdDSA`, `kid` present,
  `sub` = user id.
- **Absorb:** default JWT algorithm is **EdDSA**, not RS256.
  `requireApiAuth` must verify via JWKS (jose), never a hardcoded RS256
  key. Discriminator stays: three base64url segments + `kid` → JWT,
  otherwise opaque bearer.
  JWTs are **short-lived and non-revocable** (`expirationTime` default
  `15m`). JWKS verify does not consult the `session` table. After
  `revoke-other-sessions`, cookie and opaque bearer die immediately; a
  JWT minted before revoke stays valid until `exp`. Privileged mutations
  use cookie or opaque bearer, never JWT. 02.1 adds the revoke-vs-JWT
  integration test.

### 10 — Admin role check — proven

- **Request:** custom `ac` + `roles: { user: userAc, platform_admin: adminAc }`
  from `better-auth/plugins/admin/access`.
  `UPDATE "user" SET role = 'platform_admin'`.
  `POST /auth/admin/has-permission` `{ permissions: { user: ["list"] } }`.
  `GET /auth/admin/list-users?limit=5`.
- **Response:** has-permission 200 `{ success: true }`. list-users 200.
- **Absorb:** `admin({ adminRoles: ["platform_admin"] })` **throws**
  (`Invalid admin roles: platform_admin`) unless `roles.platform_admin`
  exists on the plugin. 02.1 must pass `ac` + `roles` for
  `user | staff_support | staff_finance | platform_admin` (phase copy
  already says this — do not ship `adminRoles` alone). Default role
  name without custom AC is `admin`. Promote via `auth.api.setRole`,
  not raw SQL.

### 11 — Google account linking by email — plan change

- **Request:** `POST /auth/sign-in/social` `{ provider: "google" }`.
  Config: `accountLinking.enabled`, `disableImplicitLinking: true`,
  `trustedProviders: ["google"]`.
- **Response:** 200 `{ redirect: true, url: https://accounts.google.com/o/oauth2/v2/auth?...&prompt=consent&access_type=offline }`.
  No live consent (placeholder client id).
- **Absorb:** the phase file’s
  `accountLinking: { enabled: true, trustedProviders: ["google"] }`
  **omits** `disableImplicitLinking: true`. ADR-017 already requires it:
  a Google sign-in whose email matches an existing user returns
  `account_not_linked`; linking is only `linkSocial()` after a verified
  session. Never link on unverified email. Applied to the phase file in
  this PR.
- **Threat model:** implicit same-email OAuth linking is an
  account-takeover path if the IdP email is attacker-controlled or
  unverified. `disableImplicitLinking` closes it. `trustedProviders`
  does **not** override that flag in 1.7.3.

### 12 — Session revocation to every client — proven

- **Request:** second `POST /auth/sign-in/email`.
  `POST /auth/revoke-other-sessions` on the first cookie session.
- **Response:** revoke 200. Caller cookie session still alive. Second
  bearer `GET /auth/get-session` → `null`.
- **Absorb:** `session.cookieCache` (300s) can keep a **cached cookie
  view** after the DB row is gone. `requireApiAuth` must not treat
  cookieCache as the source of truth for sign-out / revoke; call
  `auth.api.getSession` (hits the adapter).

### 13 — `@better-auth/drizzle-adapter` constructs — proven

- **Request:** `drizzleAdapter(drizzle(pool), { provider: "pg" })`.
- **Response:** adapter function constructed (no throw).
- **Absorb:** 02.1 uses this adapter + drizzle-kit. Do not call
  `getMigrations` on the Drizzle adapter.

## Other plan changes absorbed

1. **`GET /auth/ok` is not a Better Auth route.** 02.1 must mount a
   tiny 200 JSON next to `toNextJsHandler` (spike stubbed `/auth/ok`).
2. **Tables observed** (Kysely `getMigrations` on the spike Pool — 02.1
   re-authors these as Drizzle in `auth`): `user`, `session`
   (`activeOrganizationId`), `account`, `verification`, `organization`
   (`type`), `member`, `invitation`, `twoFactor`, `passkey`, `jwks`,
   `apikey`. Place generated Drizzle tables in `auth` schema as planned.
3. **CSRF:** state-changing `/auth/*` POSTs require `Origin` /
   `trustedOrigins`. Aligns with D-13 cookie-only origin check.
4. **Health of cookie flags on HTTP:** `SameSite=Lax`, `HttpOnly`,
   `Domain=.dev.eleva.care`. Staging/prod set `useSecureCookies: true`
   so the name becomes `__Secure-better-auth.session_token`.

## What 02.1 should copy

```ts
import { apiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import {
  admin,
  bearer,
  jwt,
  magicLink,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins"
```

Do not add these packages to the catalog at any other version.
