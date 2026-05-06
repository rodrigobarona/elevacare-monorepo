# Sprint 0 — Vercel Setup Follow-Ups (Operator Checklist)

Status: Some items completed manually in the Vercel dashboard;
integrations + hygiene items still open.

## 1. Project git connections — DONE

All 5 Vercel projects are connected to the monorepo
`rodrigobarona/elevacare-monorepo` with the correct root directories and
domains configured in the Vercel dashboard:

| Project           | Root Directory | Public host(s)                                                                                                    |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `elevacare-web`   | `apps/web`     | `eleva.care` (gateway)                                                                                            |
| `elevacare-app`   | `apps/app`     | `eleva.care` (via gateway rewrites: `/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`) |
| `elevacare-api`   | `apps/api`     | `api.eleva.care`                                                                                                  |
| `elevacare-docs`  | `apps/docs`    | `eleva.care/docs` (via gateway rewrite)                                                                           |
| `elevacare-email` | `apps/email`   | `email.eleva.care` (internal)                                                                                     |

Production branch is `main`; preview deploys fire on every other branch.
`pnpm install` is the install command; Next.js is the framework preset.

## 2. Marketplace integrations (staging + production)

Install these Vercel Marketplace integrations and link them to all 5
Vercel projects in both `preview` + `production` environments (Neon:
`eleva_v3_main` + `eleva_v3_audit` as two separate projects):

- **Neon Postgres** → projects `eleva_v3_main`, `eleva_v3_audit` (EU region)
- **Upstash Redis** (EU)
- **Upstash QStash** (EU)
- **Resend** (EU)
- **Sentry** (EU)
- **BetterStack** (EU) — uptime + logs

After each integration is installed, run `vercel env pull .env.local`
inside each app directory to confirm the expected env vars are populated.

## 3. DNS on `eleva.care` — DONE (production domains wired)

Domains configured in the Vercel dashboard per the table in section 1.
The v3 production deployment replaces the MVP on `eleva.care` itself
(no interim `dev.eleva.care` subdomain).

Branch-based environments handle the MVP → v3 cutover:

- `main` → v3 production on `eleva.care`
- feature branches / PRs → preview URLs on `*.vercel.app`
- MVP is retired on the launch date in Sprint 8 per ADR-012

Still needs DNS records (deferred to later sprints):

- `CNAME status` → BetterStack status page (S7)
- `CNAME sessions` → Daily.co branded rooms (S5)
- `TXT` for SPF / DKIM / DMARC / BIMI (S4 — email deliverability)
- optional wildcard `*.preview.eleva.care` for branded preview URLs

## 4. Internal URL hygiene

For each of the 4 new projects:

- Add a `robots.txt` rule in the project's root route handler to
  `Disallow: /` when served on `*.vercel.app` (detect via request host).
- OR configure a 301 from `elevacare-<name>.vercel.app` to the canonical
  `eleva.care/...` URL. (ADR-014 requirement.)

The 301 approach is preferred and is tracked as a Sprint 7 hardening item.

## 5. Verification

S0 exit-gate checks once the outstanding Marketplace integrations land:

- `eleva.care/patient` serves the `apps/app` placeholder via rewrite
- `eleva.care/docs` serves the `apps/docs` placeholder via rewrite
- `api.eleva.care/health` returns `{ status: 'ok' }`
- `vercel env pull` populates expected vars in each app
- Internal Vercel project URLs (`elevacare-*.vercel.app`) return
  `noindex` or 301 to the canonical `eleva.care` equivalent
