# Phase 07.0 — TOConline spike (throwaway)

Evidence lives in `docs/eleva-v3/spikes/07-toconline.md`. Delete this directory
before PR 07.1.

## Guard

`TOCONLINE_SERIES_PREFIX` **must** start with `TEST-`. The runner exits 2 if
the prefix is missing, `ELEVA`, or any other live series. Do not issue
documents into `ELEVA-FEE-*` / `ELEVA-SAAS-*`.

## Run

```bash
pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts
```

Required env (see root `.env.example`):

| Key                                               | Notes                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `TOCONLINE_CLIENT_ID` / `TOCONLINE_CLIENT_SECRET` | Eleva **test** app only                                                        |
| `TOCONLINE_API_BASE_URL`                          | From TOConline Empresa → Configurações → Dados API. Alias: `TOCONLINE_API_URL` |
| `TOCONLINE_OAUTH_BASE_URL`                        | Same source. Alias: `TOCONLINE_OAUTH_URL`                                      |
| `TOCONLINE_OAUTH_REDIRECT`                        | Must match the app in Dados API. Alias: `TOCONLINE_URI_REDIRECT`               |
| `TOCONLINE_SERIES_PREFIX`                         | Must start with `TEST-` (example `TEST-ELEVA-FEE`)                             |

Official docs (https://api-docs.toconline.pt/autenticacao-detalhada) treat
`API_URL` and `OAUTH_URL` as **credentials issued per company**, not literals
to copy from historical notes. Verify hostnames against that page and the
Dados API screen during the spike; never hardcode them into
`packages/accounting/src`.

## What this scaffold does not do

- Does not obtain an OAuth code (needs a browser login).
- Does not create customers, services, invoices, PDFs, AT submissions, or
  credit notes.
- Does not claim 07.0 complete until a TEST- series run is recorded in the
  spike evidence file.
