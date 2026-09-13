# Spike 07.0 — TOConline test-series probe

**Status:** partial — **not complete**. Guard, hosts, and OAuth _shape_ are
proven. Invoice, PDF, AT, and credit-note checks are blocked on a real
Dados API client secret. Do not start PR 07.1.
**Date:** 2026-09-13
**TOConline:** Eleva company credentials from local env. Live `ELEVA` series
refused. Founder series **TEST** accepted by the runner.
**Instance:** throwaway `pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts`

## Why issuance stopped

Local `.env.local` now has `TOCONLINE_SERIES_PREFIX=TEST` (the founder-created
series: “E uma série para testar integração de…”, company Buzios e Tartarugas
Lda / 515001708). The runner **accepts** exact `TEST` and any `TEST-…`
prefix, and **exits 2** for live `ELEVA`.

OAuth **authorization** matches official docs
(https://api-docs.toconline.pt/autenticacao-simplificada): `GET {OAUTH_URL}/auth`
returns **302** `Location: https://oauth.pstmn.io/v1/callback?code=…` (64-char
code) with no browser login. Postman callback title: “Your call is
authenticated.”

`POST {OAUTH_URL}/token` then returns **403** `{"error":"access_denied"}` for
every documented exchange style (HTTP Basic; Basic + `redirect_uri`; body
`client_id`/`client_secret`; PKCE S256). The runner now always sends
`redirect_uri` on the code exchange. `grant_type=client_credentials` returns
**501 Not Implemented**.

Local `TOCONLINE_CLIENT_SECRET` is **identical** to `TOCONLINE_CLIENT_ID`
(placeholder copy). `/auth` only needs the id, so it succeeds; `/token` rejects
the Basic `id:id` pair. Do **not** invent a secret. Operator: Empresa →
Configurações → Dados API, paste the real secret into gitignored `.env.local`,
re-run this spike.

No customer, service, invoice, PDF, AT, or credit-note call was made after the
token failure (no Bearer token). Live `ELEVA` was never used as a series.

## Versions / API (docs + this run)

Verified 2026-09-13 against https://api-docs.toconline.pt/llms.txt,
https://api-docs.toconline.pt/autenticacao-detalhada,
https://api-docs.toconline.pt/autenticacao-simplificada, and
https://api-docs.toconline.pt/apis/vendas/documentos-de-venda.md:

| Item                                                                             | What the official docs say                                                                                                   | This run                                                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `API_URL` / `OAUTH_URL`                                                          | Issued **per company** on Dados API, not published as a global hostname                                                      | Env hosts: `api33.toconline.pt`, `app33.toconline.pt` (Dados API snapshot, not source literals) |
| OAuth                                                                            | Authorization Code; `GET {OAUTH_URL}/auth` (`scope=commercial`); `POST {OAUTH_URL}/token` with HTTP Basic `client_id:secret` | `/auth` 302 + code proven. `/token` 403 `access_denied` with placeholder secret.                |
| Client credentials                                                               | Not in official auth pages                                                                                                   | `POST /token` `grant_type=client_credentials` → **501** `BROK…` / “Not Implemented”             |
| Access token TTL                                                                 | `expires_in` (example 14400 s ≈ 4 h); refresh grant `grant_type=refresh_token`                                               | Unproven (no token).                                                                            |
| Default Postman redirect                                                         | `https://oauth.pstmn.io/v1/callback`                                                                                         | Matches env; callback received the code.                                                        |
| v1 sales / purchase / receipt / payment headers                                  | `Authorization: Bearer`, `Content-Type: application/json`, `Accept: application/json`                                        | Not exercised against a document.                                                               |
| Legacy JSON:API headers (customer, supplier, address, contact, product, service) | `Authorization: Bearer`, `Content-Type: application/vnd.api+json`, `Accept: application/json`                                | Not exercised.                                                                                  |
| Sales document series fields                                                     | `document_series_id` and `document_series_prefix` on `POST /api/v1/commercial_sales_documents`                               | Docs only. Runner will pass `TEST` + looked-up id; never `ELEVA`.                               |
| AT communication                                                                 | `PATCH /send_document_at_webservice` requires Portal das Finanças `entity_username` + base64 `entity_password`               | Env has no `TOCONLINE_AT_*` keys.                                                               |

Historical internal table (`docs/eleva-v3/toconline-api-reference.md`) lists
`https://api33.toconline.pt` and `https://app33.toconline.pt/oauth` as a
**historical snapshot only**. 07.1 must read `TOCONLINE_API_BASE_URL` /
`TOCONLINE_OAUTH_BASE_URL` from the per-company Dados API credential (aliases
`TOCONLINE_API_URL` / `TOCONLINE_OAUTH_URL`) and never paste those hosts into
`packages/accounting/src`.

## Contract checks

### 00 — TEST series guard — proven (local)

- **Request:** runner with `TOCONLINE_SERIES_PREFIX=TEST` (founder series).
- **Response:** guard passes; process continues. Earlier `ELEVA` still exits 2.
- **Absorb:** exact `TEST` is allowed, not only `TEST-…`. Live `ELEVA` stays
  refused.

### 01 — OAuth hostnames + authorization code — partial

- **Request:** `GET {OAUTH_URL}/auth?response_type=code&scope=commercial`
  (no redirect follow).
- **Response:** **302**, `Location` host `oauth.pstmn.io`, path `/v1/callback`,
  query key `code` (64 chars). Browser follow lands on Postman “Your call is
  authenticated.”
- **Token:** `POST {OAUTH_URL}/token` + HTTP Basic → **403**
  `{"error":"access_denied"}`. Same for body credentials and PKCE.
- **Absorb:** hosts and `/auth` match official simplified auth. Token exchange
  needs the real Dados API secret (not a copy of the client id). Confirm Basic
  vs body again after the secret is set.

### 01b — Client credentials — proven unused

- **Request:** `POST /token` `grant_type=client_credentials` + HTTP Basic.
- **Response:** **501** Not Implemented.
- **Absorb:** do not implement client-credentials in 07.1.

### 01c — Series list — unproven

Blocked on access token. Next run must look up
`GET /api/commercial_document_series?filter[document_type]=FT&filter[prefix]=TEST`
and refuse any `ELEVA` id.

### 02 — Customer upsert — unproven

Blocked on access token. Planned throwaway: NIF `999999990`, name
`Eleva 07.0 spike TEST customer`.

### 03 — Service upsert — unproven

Blocked on access token. Planned throwaway: code `ELEVA-SPIKE-070`.

### 04 — Invoice in TEST series — unproven

Blocked. Runner will set `document_series_prefix=TEST` and the looked-up TEST
FT `document_series_id`. Must not use `ELEVA` / `ELEVA-FEE-{YYYY}`.

### 05 — PDF retrieval — unproven

`GET /api/url_for_print/:id?filter[type]=Document&filter[copies]=1` after an
issued TEST FT.

### 06 — AT communication — unproven

Official payload needs Portal das Finanças credentials
(`TOCONLINE_AT_USERNAME` / `TOCONLINE_AT_PASSWORD`). Those keys are **absent**
from local env. The runner also requires `TOCONLINE_SPIKE_SEND_AT=1` and a
successful TEST credit note before it calls AT, so a throwaway FT is never
reported to the tax authority without a reversing NC.

### 07 — Credit note — unproven

`POST /api/v1/commercial_sales_documents` with `document_type=NC`,
`parent_documents_ids`, same TEST prefix.

### 08 — Refresh-token expiry — unproven

Docs: access ~4 h, refresh ~8 h, 401 → refresh grant. No token issued.

### 09 — Rate limits and error payloads — partial

`client_credentials` 501 payload shape recorded (JSON:API `errors[]` with
`status: "501 - Not Implemented"`). Token 403 body is only
`{"error":"access_denied"}`. No 429 observed.

## Env keys for 07.1 (do not put secrets in git)

```
TOCONLINE_CLIENT_ID=
TOCONLINE_CLIENT_SECRET=   # real Dados API secret; must not equal client id
TOCONLINE_API_BASE_URL=   # from Dados API; alias TOCONLINE_API_URL
TOCONLINE_OAUTH_BASE_URL= # from Dados API; alias TOCONLINE_OAUTH_URL
TOCONLINE_OAUTH_REDIRECT= # alias TOCONLINE_URI_REDIRECT; default Postman callback
TOCONLINE_SERIES_PREFIX=TEST
TOCONLINE_AT_USERNAME=    # Portal das Finanças; required for check 06
TOCONLINE_AT_PASSWORD=
```

Decision log: `docs/eleva-v3/decision-log.md` (2026-09-13 Phase 07.0 entry).
D-09 stays `proposed`; this spike does not sign it.

## Follow-up

1. Operator: paste the real Dados API **secret** into gitignored `.env.local`
   (and keep `TOCONLINE_SERIES_PREFIX=TEST`). Re-run the spike.
2. Optional: Portal das Finanças AT user for check 06.
3. Accountant: IVA matrix + **D-09 sign-off** (still `proposed`).
4. Delete `packages/accounting/spikes/` before PR 07.1.
