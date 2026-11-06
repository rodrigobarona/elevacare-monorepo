# Production deploy checklist (v3 projects)

Run in order. Applies to the `elevacare-*` Vercel projects behind `dev.eleva.care` and `api.eleva.care`,
which run on Stripe test keys under the 2026-10-21 dev-prod exception. `eleva.care` is still the MVP.

Merging to `main` does not deploy. The Hobby plan allows a limited number of deployments per day, and
every push also spends quota on preview attempts.

## 1. Migrate

CI only migrates preview branches. If `packages/db/src/migrations/main` changed since the last deploy,
run `pnpm db:migrate` with the production **unpooled** URL before deploying, or API reads fail with
Postgres `42703`.

The licence gate needs **0071** and **0072** on production before the API deploys.

## 2. Deploy

`NEXT_PUBLIC_MEDIA_BASE_URL` is read at build time, so set it before building.

Merges to `main` auto-deploy through Git while Vercel quota remains. When a deploy is run by hand, deploy `elevacare-api` first, then `elevacare-app`, `elevacare-expert`, `elevacare-team`,
`elevacare-web` and `elevacare-admin`. `elevacare-admin` needs `NEXT_PUBLIC_API_URL` set first, because
the licence review queue calls the API. Trigger them from the merged commit, not by redeploying an old deployment: a redeploy
ships the old code with the new environment.

## 3. Register schedules

```bash
API_BASE_URL=https://api.eleva.care pnpm qstash:setup
pnpm qstash:list
```

Expect 8 schedules: 3 ticks, audit drainer, reconciliation, 3 payouts. Leave the retention sweep off until
DPO sign-off (AUD-028). `POST /workflows/tick/minutely` must answer 401 without a token, not 404.

## 4. Check on the deployed site

- [ ] Guest funnel on `dev.eleva.care` with `4242 4242 4242 4242`, through Checkout Sessions.
- [ ] A booking code applies and the total changes. Codes need `metadata.eleva_scope=booking`.
- [ ] `/join` loads Daily with no CSP error in the browser console.
- [ ] Two browsers on a real booking inside its join window. Attendance is recorded from Daily's real
      webhook deliveries (webhook registered 2026-10-30).
- [ ] Sentry shows no new `booking confirm not_found` events.
- [ ] A new expert finishing setup files a licence application, and `/partners` in admin shows it.
- [ ] Every `active` expert profile has an approved licence application. The public terms, FAQ and
      ERS page say every listed expert is verified, and profiles active before 2026-10-30 are not checked automatically.
      Active profiles appear as "Needs verification".

## Known requirements before real money

- **Eleva's Stripe balance must stay positive.** When a code brings the charge below the expert's net,
  the transfer is paid from Eleva's available balance, and a balance that can't cover it fails the
  transfer. It retries, then stops at `failed` with a Sentry alert. Keep a float, or the expert waits.
- **The first payout to each Connect account needs staff approval.** It stays at `approval_required`.
- **A paid booking whose expert has no Connect account opens no payout.** Publishing blocks this, so it
  raises a Sentry alert and needs a person to resolve it.
- **Every expert needs a Connect account before their paid offer goes live.** Seeded offers skip the
  publish gate, so confirm `fisiomota` has one in production before relying on its payouts.
