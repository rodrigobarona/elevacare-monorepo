# Spike 07.0 — TOConline test-series probe

**Status:** scaffold only — **not complete**. Issuance, PDF, AT, and credit-note
checks are unproven. Do not start PR 07.1.
**Date:** 2026-09-13
**TOConline:** Eleva company credentials from local env. Live series refused.
**Instance:** throwaway `pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts`

## Why this spike stopped

Local `.env.local` has TOConline **test-mode client id/secret** and
`TOCONLINE_SERIES_PREFIX=ELEVA` (production series `ELEVA-FEE-*` /
`ELEVA-SAAS-*`). The 07.0 runner **must not** create documents in that series.
A dedicated `TEST-…` series (example `TEST-ELEVA-FEE`) plus matching prefix
in env is required before any customer / service / invoice / AT call.

Do **not** invent live credentials. Operator: Empresa → Configurações →
Dados API (https://api-docs.toconline.pt/autenticacao-detalhada).

## Versions / API (docs, not hardcoded in product code)

Verified 2026-09-13 against https://api-docs.toconline.pt/llms.txt and
https://api-docs.toconline.pt/autenticacao-detalhada:

| Item                                                                             | What the official docs say                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `API_URL` / `OAUTH_URL`                                                          | Issued **per company** on Dados API, not published as a global hostname                                                      |
| OAuth                                                                            | Authorization Code; `GET {OAUTH_URL}/auth` (`scope=commercial`); `POST {OAUTH_URL}/token` with HTTP Basic `client_id:secret` |
| Access token TTL                                                                 | `expires_in` (example 14400 s ≈ 4 h); refresh grant `grant_type=refresh_token`                                               |
| Default Postman redirect                                                         | `https://oauth.pstmn.io/v1/callback`                                                                                         |
| v1 sales / purchase / receipt / payment headers                                  | `Authorization: Bearer`, `Content-Type: application/json`, `Accept: application/json`                                        |
| Legacy JSON:API headers (customer, supplier, address, contact, product, service) | `Authorization: Bearer`, `Content-Type: application/vnd.api+json`, `Accept: application/json`                                |

Historical internal table (`docs/eleva-v3/toconline-api-reference.md`) lists
`https://api33.toconline.pt` and `https://app33.toconline.pt/oauth` as a
**historical snapshot only**. 07.1 must read `TOCONLINE_API_BASE_URL` /
`TOCONLINE_OAUTH_BASE_URL` from the per-company Dados API credential (aliases
`TOCONLINE_API_URL` / `TOCONLINE_OAUTH_URL`) and never paste those hosts into
`packages/accounting/src`.

## Contract checks

### 00 — TEST- series guard — proven (local)

- **Request:** runner with `TOCONLINE_SERIES_PREFIX=ELEVA` (live).
- **Response:** process exits 2; no HTTP call.
- **Absorb:** spike code cannot issue into `ELEVA`. Create `TEST-ELEVA-FEE` (or
  similar) in the Eleva TOConline company and set `TOCONLINE_SERIES_PREFIX=TEST-…`.

### 01 — OAuth hostnames — unproven (blocked on TEST- + interactive login)

Official docs do not hardcode `api33` / `app33`. Confirm on Dados API, then
record the hosts here (not in application source).

### 02 — Customer upsert — unproven

Blocked on TEST- series + access token.

### 03 — Service upsert — unproven

Blocked on TEST- series + access token.

### 04 — Invoice in TEST- series — unproven

Blocked. Must not use `ELEVA-FEE-{YYYY}`.

### 05 — PDF retrieval — unproven

### 06 — AT communication — unproven

### 07 — Credit note — unproven

### 08 — Refresh-token expiry — unproven

Docs: access ~4 h, refresh ~8 h, 401 → refresh grant. Not exercised.

### 09 — Rate limits and error payloads — unproven

## Env keys for 07.1 (do not put secrets in git)

```
TOCONLINE_CLIENT_ID=
TOCONLINE_CLIENT_SECRET=
TOCONLINE_API_BASE_URL=   # from Dados API; alias TOCONLINE_API_URL
TOCONLINE_OAUTH_BASE_URL= # from Dados API; alias TOCONLINE_OAUTH_URL
TOCONLINE_OAUTH_REDIRECT= # alias TOCONLINE_URI_REDIRECT
TOCONLINE_SERIES_PREFIX=TEST-ELEVA-FEE
```

Decision log: `docs/eleva-v3/decision-log.md` (2026-09-13 Phase 07.0 entry).
D-09 stays `proposed`; this spike does not sign it.

## Follow-up

1. Accountant: TEST- series in Eleva TOConline + IVA matrix + **D-09 sign-off**
   (still `proposed` in `decision-log.md`).
2. Re-run this spike with `TEST-` prefix; fill checks 01–09 with request/response
   ids (no secrets).
3. Delete `packages/accounting/spikes/` before PR 07.1.
