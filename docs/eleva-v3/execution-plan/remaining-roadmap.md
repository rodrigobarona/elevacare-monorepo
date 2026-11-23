# Remaining roadmap: from today to launch

Status: Living. Reviewed 2026-11-21 against `main` at `58816804`. Updated 2026-11-23 after
the night that merged seven slices (`main` at `3a4bec75`): section 1, section 3, new items in
section 4, lessons 17 to 22, and the slice tables. **Read O-2 first: the development database
is over its quota and nothing that needs it can run or merge until that is lifted.**

This page says what is left to build before Eleva v3 replaces the MVP at `eleva.care`, in what
order, and what is waiting on a person. It does not replace the phase files: each phase file
still holds the full scope, and this page holds the state of each phase and the next slices.
Update it when a slice merges or a decision lands.

How it was made, so you know how far to trust it:

- **Code review.** Four reviewer agents read phases 11 to 14 item by item against the code on
  `main` and gave each item a file as evidence. Six of their findings were checked again by
  hand before they were written down here (section 3). Nothing was run against a database, a
  browser or a vendor account.
- **Current docs.** The SDK facts in section 11 come from Context7 on 2026-11-21, with the
  library id beside each. Context7 had Better Auth at 1.7.15 (the repo runs 1.7.18) and
  described Drizzle v1 and Sentry v11, both ahead of what is installed.
- **Design references.** Twenty-nine Mobbin references were saved for the screens still to build
  (section 10). Mobbin shows patterns, not templates.
- **Not a sign-off.** The founder, the DPO, counsel and the accountant decide what section 4
  asks them. Sizes are estimates: S is under a day, M one to two days, L more.

## 1. Where each phase stands

| Phase                        | State on 2026-11-21                                                                                                                                                                                                                                                  | Left                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 to 10                     | Engineering on `main`. Proof and sign-off lag: see section 9.                                                                                                                                                                                                        | Staging evidence, live invoicing (closed on purpose), DPO sign-offs                                                                           |
| 11 Clinics                   | Slices 11.1 to 11.7 merged: clinic profile, invitations, the Team page, the seat limit, the Verification page, the decision notice, the Overview card, a seat item on every clinic subscription.                                                                     | 11 slices (section 6): billing, sessions, schedule, settings, the public page. 11.8 waits on the operator (O-8). Four items wait on a person. |
| 12 Staff console             | Licence review and 12.1 to 12.6 merged: clinic verification, a recent sign-in for decisions, a record each time staff open a filing or read a queue page, API keys that identify their owner, queues with pages. 12.7 is open (#463), waiting on the database (O-2). | 19 slices (section 7). The security base (second factor, roles, two-person approval) comes before the features.                               |
| 13 Hardening                 | 13.1 to 13.4 and 13.28 merged: CI guards, "Try again" on every error page, a limiter that refuses when its store is slow, tests for the route guard, preview database branches that expire.                                                                          | 29 slices (section 8). Several are small and worth doing early.                                                                               |
| 14 Migration                 | 14.1 merged: the target guard. No tool reads or writes data yet.                                                                                                                                                                                                     | 24 slices and two operator steps (section 8). The first blocker is access to the MVP database, not code.                                      |
| 15 Launch                    | Not started.                                                                                                                                                                                                                                                         | 8 slices, then the operated cutover (section 8).                                                                                              |
| Design plan (`design-audit`) | 18 of 39 slices merged (D0, D1, D2.1, D2.2, D5.7 to D5.9, D7.1 to D7.5).                                                                                                                                                                                             | 21 slices (section 10).                                                                                                                       |

Numbers on `main`: 166 route handlers, 80 main migrations (`0000` to `0079`), 33 Playwright
specs, 33 packages. The staff console (`apps/admin`) has a unit-test runner since 12.6.

## 2. What we learned, and the rule each lesson became

**How we work**

1. **Small slices merge; big ones stall.** Fourteen pull requests merged in one night because
   each did one thing. Keep one concern per pull request.
2. **Three open pull requests at most.** Six at once hit the Neon limit on preview branches and
   the database job failed. A closed pull request frees its branch.
3. **Do not stack branches more than one deep.** Every slice adds an entry at the top of
   `decision-log.md`, so every merge below made the branches above conflict. Branch each track
   from `main`.
4. **Run the tests of every package the change touches before opening the pull request.** One
   pull request failed in CI because a test in `packages/db` pinned the name of the latest
   migration and nobody had run that package.
5. **A dev server starts and stops inside the command that needs it.** Servers left running
   filled the disk overnight.
6. **Read the current docs before the code.** This review found five places where the repo
   disagrees with what the SDKs do today (section 3).
7. **Mobbin before any screen.** The references and the judging criterion are saved before the
   screen is designed, not after.
8. **A migration is not shipped until it runs on production.** CI migrates preview branches
   only. Migration `0079` is on `main` and still has to be applied to the production database.

**How we review**

9. **Adversarial reviewers find what tests miss.** On 2026-11-21 they found a rule that left a
   clinic unable to answer staff, and a sign-in check that a bearer token could walk around.
   Keep the panel for every slice.
10. **A score is not a sign-off, and it goes stale.** A seat that passed was not always scored
    again after later changes. Score the code that merges.
11. **One bar.** That night used 8.0 per seat on the founder's instruction. `AGENTS.md` says
    8.5. Most seats ended between 8.0 and 8.6. The founder decides which bar the next slices
    use (section 4, F-12).
12. **Say what was not proven.** Every pull request kept a "not proven" list (a real email
    arriving, the page in Portuguese, the guard against a running auth server). Keep it.

**What the night of 2026-11-22 added**

17. **Every fix is scored again, and the second look finds what the first fix broke.** 12.7
    went through three blind panels. The first found that a wrong browser clock could block a
    decision. The fix for it redrew the page on focus, and the second panel found that each
    redraw was a recorded read of a filing and could take the form away. Fix, then score the
    fix.
18. **A read that is recorded must only happen when a person asks.** Prefetching a link,
    building a tab title from an API call and redrawing a page on focus each wrote an access
    record nobody caused (12.6, 12.7). On a page whose reads are audited, nothing fetches ahead
    and nothing refreshes by itself.
19. **Tell the browser how long, not when.** A page that compares a server moment with its own
    clock is wrong on every machine whose clock is wrong. The server counts the time left and
    the page counts down from there (12.7).
20. **Prove it in the real app once the fixture is green.** The playground showed the pager's
    states; the real console showed the columns moving between pages, the tab title and the
    audit count. Both kinds of proof are kept, and the real one is the one that is believed.
21. **The development database has a quota, and a night of tests can spend it.** At 02:46 UTC
    on 2026-11-23 Neon began refusing every query from the dev branch and from pull-request
    branches (HTTP 402). Seven pull requests' database jobs and about twenty local browser and
    integration runs came before it. Until the plan question (O-2) is settled, database-backed
    runs are spent on what cannot be proven another way.
22. **What is written and not run is said to be so.** The last two commits of 12.7 added steps
    to the browser test that never ran. The log and the pull request say which, and the slice
    stays open until they do.

**What the product now does on purpose**

13. A clinic or expert that is verified is always told it stays verified, whatever happens to
    newer details.
14. People with no account are protected by limits, not by settings they cannot reach: a
    clinic sends one invitation every eight hours to an address, invites 50 addresses a day,
    and leaves someone who declined alone for 30 days.
15. Staff decisions go through one door: a credential that can be revoked, a rate limit, a
    recent sign-in. Every time staff open a filing, it is on record.
16. A rule that two places need lives in one module (`@eleva/config`): the verification
    standing, the tax-number rule, the company's legal line.

## 3. Fix first: what this review found

Each row was checked in the code by hand on 2026-11-21. None was tested in a browser or
against a vendor. On 2026-11-23, rows 1 to 4 and 7 are fixed on `main` (12.5 #458, 11.7 #459,
13.2 #456, 13.3 #457); the deployed Stripe API version in row 7 still needs a look (O-5). Rows
5 and 6 wait on a person.

| #   | What is wrong                                                                                                                                                                                                                           | Where                                                                                                  | Effect                                                                                                                               | Slice |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | API-key sign-in reads `key.userId`, which the installed plugin no longer returns. It returns `referenceId`, the owner's user id, and the code uses that as the organization id.                                                         | `packages/auth/src/server/api-auth.ts:277`                                                             | An API key most likely cannot authenticate as anyone. It fails closed, but "every endpoint works for agents" does not hold for keys. | 12.5  |
| 2   | A clinic subscription gets a seat item only when it starts with seats. A new clinic has none, so the seat count is never sent to Stripe.                                                                                                | `packages/billing/src/server/subscriptions.ts:119`, `seats.ts:161`                                     | The seat limit works (it is checked in our database), but Stripe never bills seats.                                                  | 11.7  |
| 3   | The shared error page reads a prop named `unstable_retry`. Next 16.4.5 passes `retry`.                                                                                                                                                  | `packages/dashboard/src/route-error.tsx:15`                                                            | "Try again" has no handler on every dashboard error page.                                                                            | 13.2  |
| 4   | The rate limiter treats only a thrown error as "store down". When the store is slow, the library answers "allowed" after five seconds.                                                                                                  | `apps/api/src/lib/rate-limit.ts:186`                                                                   | Public and webhook limits, which are meant to refuse when the store is down, let requests through when it is slow.                   | 13.3  |
| 5   | The plan requires staff impersonation. The code refuses it on purpose (staff never read members' health records).                                                                                                                       | `packages/auth/src/server/account-claim.ts:241`, `phases/12-admin-console.md`                          | The phase file and the code disagree. A person decides which one changes (F-04).                                                     | none  |
| 6   | Phase 14 never writes to production, and Phase 15's only production run is the final "changes since" run. No step loads the full data.                                                                                                  | `phases/14-mvp-migration.md`, `phases/15-launch-cutover.md`                                            | As written, production would receive only the last changes. The runbook needs a dated full-load step (F-10).                         | 14.25 |
| 7   | Small Stripe mismatches: the API description says `ui_mode=embedded` (the code sends `embedded_page`); `.env.example` pins API version `2023-08-16`; checkout collects a tax number for an existing customer without `customer_update`. | `apps/api/src/lib/openapi.ts:2478`, `.env.example:135`, `packages/billing/src/server/subscriptions.ts` | Wrong docs for agents; a business customer's VAT number may not be saved. The deployed API version needs a look (O-5).               | 11.7  |

Two more to confirm with a person, not in code:

- The MVP snapshot in `_context/clone-repo/` is the WorkOS version, while an older note says
  production runs Clerk. Nobody has confirmed what production runs (F-02).
- `execution-plan/README.md` says branch protection needs one human approval. The pull requests
  of 2026-11-21 merged without one (F-13).

Found on 2026-11-23 while building, small, and not yet a slice:

| What                                                                                                                                                                                                                                          | Where                                                                                                                                                                                                                   | Goes with |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Four DELETE handlers take the path id as it comes (no UUID check, so a bad id is a 500), and one list route returns the raw error message.                                                                                                    | `apps/api/src/app/expert/{locations,schedules,event-types}/[id]`, `event-types/[id]/modes/[modeId]`, `schedule/overrides`                                                                                               | 13.4      |
| The kit's outline button has a border of about 1.2:1; the pager and the sign-in notice override it one by one. The focus ring is about 2.96:1 in the light theme. A filled button's hover loses contrast.                                     | `packages/ui/src/components/button-variants.ts`, `globals.css` (`--ring`)                                                                                                                                               | 13.32     |
| DM Sans as shipped has no tabular figures, so `tabular-nums` does nothing anywhere.                                                                                                                                                           | `packages/ui/src/fonts/`                                                                                                                                                                                                | 13.32     |
| Dashboards format numbers and dates with `pt` and `en`, not `pt-PT` and `en-IE`. In Portuguese, "0 pessoa na clínica" (zero takes the singular).                                                                                              | `packages/dashboard/src/request-config.ts`, `apps/admin/messages/pt.json`                                                                                                                                               | 13.33     |
| The staff queues page by row count: a colleague's decision moves rows between pages. Paging by "after this row" would not.                                                                                                                    | `packages/config/src/pagination.ts`                                                                                                                                                                                     | 12.15     |
| A licence can be rejected in one press; a clinic's rejection asks first.                                                                                                                                                                      | `apps/admin/src/app/partners/[expertProfileId]/decision-form.tsx`                                                                                                                                                       | 12.24     |
| The console's layout sends a person whose cookie is no longer good to sign in with no way back (the proxy, for no cookie at all, keeps the way back since 12.7).                                                                              | `apps/admin/src/app/layout.tsx`                                                                                                                                                                                         | 12.8      |
| Nothing in CI runs the `/dashboard?console=` redirect or the proxy's return address: `apps/account` has no unit tests and the browser test is opt-in.                                                                                         | `apps/account/src/app/(auth)/dashboard/route.ts`, `packages/auth/src/proxy.ts`                                                                                                                                          | 13.25     |
| Jobs that work through a list answer 200 when every item failed (Stripe down for a whole run), so the run is reported as done. Two of them write item failures to the console only.                                                           | `packages/workflows/src/scheduling/slot-reservation-expiry.ts`, `payments/process-expert-transfers.ts`, `packages/billing/src/server/seats.ts`, `packages/scheduling/src/booking-request.ts`, `packages/crm/src/due.ts` |
| A manual run of the monthly reconciliation for another month reports done and restarts the monitor's clock. Several job routes return the raw error message in their 500 answer.                                                              | `apps/api/src/app/workflows/stripe-toconline-reconciliation/route.ts`, `apps/api/src/app/workflows/*/route.ts`                                                                                                          |
| Packages have no boundary rules: each has its own lint config, so `packages/ui` could import Stripe or the database and a frontend would get it through the package. None does today.                                                         | `packages/*/eslint.config.js`, `scripts/check-boundaries.mjs`                                                                                                                                                           |
| Every other lint rule is still a warning that fails nothing (`eslint-plugin-only-warn`). Making lint fail a build means clearing every warning in 44 workspaces first.                                                                        | `packages/eslint-config/base.js`                                                                                                                                                                                        |
| The vendor bans match a banned name anywhere in a path, so a file of our own named `./better-auth` is refused. The list of reads a frontend may use lives in the lint package; a `@eleva/db/reads` entry point would put it beside its owner. | `packages/eslint-config/boundaries.js`, `frontend-db-reads.js`                                                                                                                                                          |
| Whether the Lint job (and so `check:boundaries`) is a required check in branch protection was not looked at.                                                                                                                                  | GitHub branch protection                                                                                                                                                                                                |

## 4. Waiting on a person

Engineering does not wait silently on these: it builds every slice that does not depend on
them, and stops at the one that does.

**Founder**

| Id   | Question                                                                                                                                                                                                                                                                                                            | Blocks                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| F-01 | Does v3 launch with platform-fee invoicing closed, as it is today, or does live invoicing open first? Phase 15 assumes it is open.                                                                                                                                                                                  | Phase 15 acceptance, the clinic plan invoice |
| F-02 | What does the production MVP run today (Clerk or WorkOS), and who grants a read-only database role and the provider's export?                                                                                                                                                                                       | 14.3 onward                                  |
| F-03 | Which staff roles may verify a licence or a clinic? Must a second person approve, and are there two staff accounts to do it?                                                                                                                                                                                        | 12.12, 12.14 to 12.16                        |
| F-04 | Impersonation: remove it from Phase 12, or reopen it with which guards? The same for a break-glass read of a record.                                                                                                                                                                                                | Phase 12 scope                               |
| F-05 | For a booking with a clinic's expert: who is paid (the clinic's account or the expert's), and when is the commission 0% (any clinic service, or only the clinic page)?                                                                                                                                              | 11.13, 11.17                                 |
| F-06 | Is there an Enterprise plan at launch, and with what terms?                                                                                                                                                                                                                                                         | 11.8 copy                                    |
| F-07 | Confirm that only the owner invites or removes a clinic's admins.                                                                                                                                                                                                                                                   | 11.10                                        |
| F-08 | Rate limits: the code has 10 and 60 a minute, the Phase 13 file says 20 and 120. Which numbers, and do signed-in limits refuse when the store is down? Since 13.3 public and webhook routes refuse when the store is slow or down: confirm that a provider's webhook should be refused then (the provider retries). | 13.6                                         |
| F-09 | Is product analytics (PostHog, GA4) wanted at launch?                                                                                                                                                                                                                                                               | Phase 13 analytics scope                     |
| F-10 | Cutover: the freeze window, the day of the full load, and the welcome message (copy, waves, sender).                                                                                                                                                                                                                | 14.23, 14.25, Phase 15                       |
| F-11 | What kind and title does an MVP note get in v3, and what happens to several notes on one session?                                                                                                                                                                                                                   | 14.15                                        |
| F-12 | The bar for the review panel: 8.0, as used on 2026-11-21, or 8.5, as `AGENTS.md` says? Should those slices be scored again?                                                                                                                                                                                         | Every UI slice                               |
| F-13 | Branch protection: require a human approval and the database job on `main`?                                                                                                                                                                                                                                         | Process                                      |
| F-14 | Book an EU penetration test, and choose the DPO provider.                                                                                                                                                                                                                                                           | Phase 15 gate                                |
| F-15 | API keys: nobody can make one today (12.5 closed the door: any session could mint a key that never expired). Before it reopens: an expiry, revoked on password reset, tied to one workspace, and never for staff decisions or money. Which of these, and who may create one?                                        | Agents using keys                            |
| F-16 | May a token or an API key read the staff queues at all? Today it may, and the record says how the read was made; a key cannot decide.                                                                                                                                                                               | 12.12                                        |

**DPO** (ids start with P, for privacy; `D-NN` stays the name of the decision gates in the README)

| Id   | Question                                                                                                                                                                                                                                                                                                                                                                                                   | Blocks                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P-01 | Shared records in a clinic: what members are told, and whether the clinical access model (gate D-11) must be signed again before any clinic can turn it on.                                                                                                                                                                                                                                                | The shared-records setting                     |
| P-02 | Retention periods: ended invitations (90 days proposed, never under 37), refused filings, staff access records (a filing opened, and since 12.6 each page of a queue served), published events, legacy audit rows.                                                                                                                                                                                         | 13.21 to 13.24 schedules                       |
| P-03 | Privacy-notice lines for invited people and for clinics, and how staff are told that their reads are recorded. The entry screen's sentence was changed in 12.6 to say what happens ("What you open and what you change are recorded"); it is interim, nobody approved it, and only people arriving from another workspace see it. The formal notice has to exist before the console is used in production. | First real clinic, staff console in production |
| P-04 | May a decline lapse after 30 days? Does someone with no account need a way to object without signing up? Who answers a request to stop, and by when?                                                                                                                                                                                                                                                       | Invitations at launch                          |
| P-05 | The MVP holds no acceptance timestamps for members. Import the consent given at Stripe Checkout and the practitioner agreement, or ask again at first sign-in?                                                                                                                                                                                                                                             | 14.16                                          |
| P-06 | Who may run a migration rehearsal, when its copy is deleted, and whether a masked copy is required.                                                                                                                                                                                                                                                                                                        | 14.20                                          |
| P-07 | Sign the impact assessment, add clinic verification and the access log to the record of processing, and close the two Phase 10 items (retention of records, the AI-processing copy).                                                                                                                                                                                                                       | Phase 15 gate                                  |
| P-08 | The staff access log: who may read colleagues' records and who must review them, how often; whether logging employees' reads needs a review under employment law; whether a record per queue page, which cannot say whose rows were on it, is enough.                                                                                                                                                      | Staff console in production                    |

**Counsel**

| Id   | Question                                                                                                                          | Blocks                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| C-01 | What "Verified" may claim for a clinic; whether a clinic needs its own health-regulator registration; a way to contest a refusal. | 11.17 going live        |
| C-02 | Company details on emails; plan limits in the published terms; what the expert agreement says when a clinic removes someone.      | 11.8, first real clinic |
| C-03 | The regulator pages for Portugal.                                                                                                 | 15.5                    |

**Accountant and finance**

| Id   | Question                                                                                                                                                                                                                                                             | Blocks       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| A-01 | Does a VAT-exempt clinic show as valid in VIES? The staff check relies on it.                                                                                                                                                                                        | First clinic |
| A-02 | Which commission and expiry does each MVP plan keep after the move?                                                                                                                                                                                                  | 14.14        |
| A-03 | May the clinic plan's invoice be recorded as pending while issuing stays closed? How are seat changes prorated? Since 11.7 the first sync of a clinic that already has members charges the seats in use, prorated, on the next invoice: confirm that this is wanted. | 11.8         |
| A-04 | The €200 threshold for refunds that need a second person was due for review on 2026-09-21.                                                                                                                                                                           | 12.16        |

**Operator**

| Id   | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1  | Apply migration `0079` to the production database. Until then a staff decision works but its notice fails.                                                                                                                                                                                                                                                                                                                                                                                    |
| O-2  | **Blocking since 2026-11-23 02:46 UTC.** The Neon project used by local development and by pull-request branches answers every query with HTTP 402, "exceeded the quota". Production reads were checked and work. Until the quota is lifted or the plan changed: no local browser or integration run, and every pull request's `neon-branch-migrate-and-rls` job fails, so nothing merges. Also still open: the docs include ten branches, and the limit was hit with six pull requests open. |
| O-3  | Create the Sentry EU project and token, the BetterStack account and the status page address.                                                                                                                                                                                                                                                                                                                                                                                                  |
| O-4  | Run one point-in-time restore on Neon and record it.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| O-5  | Check which Stripe API version is deployed. A check at start-up that refuses an older one was proposed in review and held back until this is known.                                                                                                                                                                                                                                                                                                                                           |
| O-6  | Staging evidence still owed: pay to payout (Phase 06) and the two-browser session with webhooks (Phase 09).                                                                                                                                                                                                                                                                                                                                                                                   |
| O-7  | Daily webhooks: set `retryType` to `exponential` (the command is in `operator-tasks/daily-setup.md`). Since 13.3 a webhook is refused while the limiter's store is down, and Daily's default gives up after a few tries.                                                                                                                                                                                                                                                                      |
| O-8  | Give the Stripe test account a head-office address. Without it Checkout with automatic tax cannot be tried, which blocks 11.8.                                                                                                                                                                                                                                                                                                                                                                |
| O-9  | Delete the API keys made before 2026-11-24 (`auth.apikey`): they are refused since 12.5 and only take up room.                                                                                                                                                                                                                                                                                                                                                                                |
| O-10 | Look at the latency of the Upstash store from the API's region: the limiter now gives it one second.                                                                                                                                                                                                                                                                                                                                                                                          |
| O-11 | Set `ADMIN_URL` on the account project in every environment, or a staging sign-in started from the console returns to the production console (12.7).                                                                                                                                                                                                                                                                                                                                          |
| O-12 | Once O-2 is lifted: run `e2e/admin-clinics.spec.ts` on the 12.7 branch (its later steps have never run), retake its real-console captures, then merge #463 (12.7), #465 (14.2, nothing in it uses a database) and this roadmap update. #464 and #465 both regenerate `execution-plan/index.html`: after the first merges, run `pnpm docs:execution-plan:html` on the other.                                                                                                                   |
| O-13 | Switch on the dependency graph for the repository (it is off): GitHub can then review the dependencies a pull request adds. After the first CodeQL findings are sorted, make "Code scanning results / CodeQL" a required check or add a code scanning ruleset, or the scan only reports. Leave code scanning's default setup off (13.13).                                                                                                                                                     |

## 5. Order of work

Four tracks run side by side, one open pull request each, three open in total.

| Track       | What                            | Order                                                  |
| ----------- | ------------------------------- | ------------------------------------------------------ |
| A Product   | Clinics, then the staff console | 11.7 to 11.18, then 12.5 to 12.25                      |
| B Platform  | Hardening                       | 13.2, 13.3, 13.25 to 13.28 first; then by group        |
| C Migration | MVP data                        | 14.2 to 14.5 now (no data needed); the rest after F-02 |
| D Design    | The design plan's open slices   | D7.6 to D7.8, then D2.3 to D2.5, D4, D5, D3, D6        |

**Wave 0: fix what the review found.** Done on 2026-11-23: 12.5, 11.7, 13.2, 13.3 are on
`main`, with 13.4, 13.28 and 12.6 beside them. Operator: O-1, and now O-2 before anything else. Start the slow
human items the same week, because they set the launch date more than any code does: F-01,
F-02, F-03, F-14, P-07.

**Wave 1: clinics can pay and be found.** 11.8 to 11.18. Beside it: tests that run signed in on
every pull request (13.25, 13.26), so later slices are proven in CI and not only on a laptop;
Sentry that knows the release (13.16 to 13.18); the migration frame (14.2 to 14.5).

**Wave 2: the staff console is safe to operate.** 12.6 to 12.14: the second factor, roles in one
table, taking back an approval, two-person approval. Beside it: rate-limit classes and the
content security policy (13.5 to 13.9); the first mappers (14.6 to 14.13) once F-02 is answered.

**Wave 3: the rest of the console and the rehearsals.** 12.15 to 12.25. Beside it: retention
sweeps (13.21 to 13.24), performance and accessibility (13.29 to 13.32), rehearsals one and two.

**Wave 4: the launch gate.** Penetration-test fixes, the signed impact assessment, rehearsal
three, 15.1 to 15.8, then the operated cutover and the seven-day watch.

The expert pilot on staging (decision log 2026-11-06) is a gate of its own before any real
expert is invited. Its open items are in `audits/2026-11-expert-pilot-council.md`; three of
them are slices here (12.8, 13.14, 13.32).

## 6. Phase 11: clinics

Slices, in order. "Refs" are Mobbin references in `_context/mobbin/library/`.

| Id    | Title                                                        | What it includes                                                                                                                                                                  | Depends on                     | Size | Screen | Proof                                            |
| ----- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---- | ------ | ------------------------------------------------ |
| 11.7  | **Merged (#459).** Every clinic subscription has a seat item | Attach it at creation and checkout; create it when missing; save the tax number (`customer_update`); correct the API text. Finding 2 and 7.                                       | A-03                           | S    | No     | Unit tests, one run in Stripe test mode          |
| 11.8  | The clinic's Billing page                                    | `/team/{slug}/billing`: plan, seats in use, checkout in the page, invoices. Where a plan change happens (Stripe's portal or our server) is tried in test mode first (section 11). | 11.7 (merged), O-8, C-02, A-03 | M    | Yes    | New opt-in e2e. Refs `11-team/14` to `17`        |
| 11.9  | "No seat left" points to Billing                             | A link from the Team page and from the expert's message, saying what a bigger plan gives.                                                                                         | 11.8                           | S    | Yes    | Route test, capture. Ref `11-team/18`            |
| 11.10 | Change a role; leave a clinic                                | Two endpoints and the Team page actions.                                                                                                                                          | F-07                           | M    | Yes    | Integration test                                 |
| 11.11 | People notices                                               | An email when someone joins or is removed; clear the removed person's active workspace and keys.                                                                                  | none                           | M    | Email  | Sender tests. Adds a migration (kinds)           |
| 11.12 | Clinic settings                                              | Name, description, logo (public bucket, verified upload), specialties, billing address.                                                                                           | none                           | M    | Yes    | Route test, opt-in e2e                           |
| 11.13 | All the clinic's sessions                                    | `GET /teams/{id}/bookings` and a list filtered by expert and date. Writes `attributed_org_id`, which exists and is never written today.                                           | F-05                           | M    | Yes    | Row-level security test. Refs `11-team/19`, `20` |
| 11.14 | The clinic's schedule, read only                             | `GET /teams/{id}/schedule` and a week with experts side by side.                                                                                                                  | 11.13                          | M    | Yes    | Route test, capture. Refs `11-team/21`, `22`     |
| 11.15 | Overview shows sessions and seats                            | Upcoming sessions and the seat line on the first page.                                                                                                                            | 11.13                          | S    | Yes    | e2e capture                                      |
| 11.16 | Clinics share the public name space                          | Clinic names in `public_handles` with a backfill; a flag; `GET /public/clinics/{slug}` for verified clinics only.                                                                 | none                           | M    | No     | Collision test. Adds a migration                 |
| 11.17 | The clinic's public page                                     | The page, its experts, the sitemap, behind the flag.                                                                                                                              | 11.16, C-01                    | M    | Yes    | 404 until verified. Refs `03-profile/25`, `26`   |
| 11.18 | One clinic e2e, and the phase file corrected                 | One spec for the whole journey; the corrections below.                                                                                                                            | the above                      | S    | No     | Spec passes on loopback                          |

Waiting on a person:

- **The clinic plan's invoice** (`invoice.finalized` to the SaaS series): F-01 and A-03.
- **Shared records** (the setting, its reason, the member notice): P-01. Refs `11-team/23`, `24`
  show the confirmation and "turned on by"; Mobbin had no example that asks for a written reason.
- **Who is paid and when the commission is 0%**: F-05. Today the code pays the account of the
  organization that owns the booking and reads 0% from that organization's plan.
- **Enterprise plan**: F-06.

Smaller items the 11.x records leave open, to fold into the slices above or the backlog: a
unique index on a pending invitation per address; accepting an invitation through an `apps/api`
route so membership and audit commit together; the inviter's name in place of the email; a real,
localized link to the privacy notice in the invitation; a support tool to stop one clinic's
invitations to an address; a narrower read for the Overview card.

## 7. Phase 12: staff console

The security base comes first, because the features after it (bans, refunds, replays) are only
as safe as the door in front of them.

| Id    | Title                                                                                   | What it includes                                                                                                                          | Depends on    | Size | Screen | Proof                                        |
| ----- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---- | ------ | -------------------------------------------- |
| 12.5  | **Merged (#458).** API keys identify their owner again; the staff guard is proven       | Read `referenceId`; a test that drives the sign-in guard through a real auth instance, with a cookie, a bearer token and both. Finding 1. | none          | M    | No     | In-memory auth test                          |
| 12.6  | **Merged (#462).** Queues have pages, and reading them is on record                     | A page size for both queues; a record of each queue read.                                                                                 | none          | S    | Yes    | Route and integration tests                  |
| 12.7  | **Open (#463), waits on O-2 for its last browser run.** The sign-in-again message helps | A link to sign in, the typed reason kept, and the check when the page opens.                                                              | none          | S    | Yes    | Component test, capture                      |
| 12.8  | Staff need a second factor to enter the console                                         | Enrolment, and a check at the console's door for every way of signing in. The plugin only challenges password sign-in (section 11).       | none          | M    | Yes    | e2e with and without a factor                |
| 12.9  | A decision needs the factor checked in the last 10 minutes                              | Our own re-check endpoint and timestamp; replaces the 12-hour check.                                                                      | 12.8          | M    | Yes    | Route test: refused, re-checked, accepted    |
| 12.10 | Staff sessions end after 12 idle hours                                                  | Idle expiry; a new device or network signs out.                                                                                           | 12.8          | S    | No     | Unit tests                                   |
| 12.11 | The console has its own cookie                                                          | A spike first: Better Auth has no option for a host-only cookie, so this needs a second auth instance or our own cookie layer.            | 12.8, a spike | L    | No     | The shared cookie is refused on staff routes |
| 12.12 | One table says which role may do what                                                   | Every staff route reads it; a test walks the whole table.                                                                                 | F-03          | M    | No     | Table-driven test                            |
| 12.13 | Take back a clinic's verification; record who filed                                     | The action, its reason and notice; a column for the person who sent the details.                                                          | 12.9          | M    | Yes    | Integration test. Adds a migration           |
| 12.14 | Two-person approval                                                                     | A request, a claim, an approval by someone else, an expiry.                                                                               | 12.9, 12.12   | L    | No     | Concurrency tests. Adds a migration          |
| 12.15 | The approvals queue                                                                     | Pending, mine, done; who asked and when.                                                                                                  | 12.14         | M    | Yes    | e2e with two staff. Refs `13-admin/11`, `12` |
| 12.16 | Large refunds and held payouts need two people                                          | Wire both to 12.14.                                                                                                                       | 12.14, A-04   | M    | No     | One test per kind                            |
| 12.17 | Payouts screens                                                                         | Over the API that exists.                                                                                                                 | 12.9          | M    | Yes    | Seeded e2e                                   |
| 12.18 | Search the audit trail                                                                  | By reference, person and record; staff access records included.                                                                           | 12.12         | M    | Yes    | Integration test. Refs `13-admin/13`, `14`   |
| 12.19 | Find a person; suspend, restore, sign out everywhere                                    | Search, detail, sessions, and the three actions with a reason.                                                                            | 12.9, 12.12   | M    | Yes    | Route tests, e2e. Refs `13-admin/04`, `06`   |
| 12.20 | Suspend and restore an expert's listing                                                 | With a reason and a notice to the expert.                                                                                                 | 12.14         | M    | Yes    | Route tests                                  |
| 12.21 | Payment events and failed jobs: see and send again                                      | Stripe events, failed deliveries, the dead-letter queue.                                                                                  | 12.9          | M    | Yes    | Idempotency test. Refs `13-admin/15`, `16`   |
| 12.22 | Find a booking; cancel as staff                                                         | Search, detail, cancel with refund rules.                                                                                                 | 12.16         | M    | Yes    | Route tests                                  |
| 12.23 | Accounting lists, flags, health                                                         | Read-only lists.                                                                                                                          | 12.12         | M    | Yes    | Route tests                                  |
| 12.24 | Licence evidence and decision history                                                   | Upload to the private bucket, streamed by the API; earlier decisions on the review page.                                                  | none          | M    | Yes    | Upload test. Adds a migration                |
| 12.25 | One staff e2e, the playbooks, the phase file corrected                                  | The corrections below.                                                                                                                    | all           | S    | No     | Seeded e2e                                   |

Next: 12.8. It also owns two things 12.7 left: the sign-in page still greets a reviewer in the
middle of a decision with "Welcome back" and "Create an account", and "Sign in again" ends the
session in every Eleva tab without saying so. 12.11 (the console's own cookie) changes how a
sign-in at the gateway reaches the console: the way back built in 12.7 has to be walked again
with it.

Waiting on a person: F-03 (roles, two people), F-04 (impersonation, break-glass read), A-04 (refund
threshold), P-03 and P-07 (what staff and clinics are told; the record of processing).
References for impersonation (`13-admin/07`, `08`) and staff-only notes (`13-admin/09`, `10`) are
saved in case F-04 reopens it.

## 8. Phases 13, 14 and 15

### Phase 13: hardening

| Group                   | Id    | Title                                                                                                      | Size | Note                                                                                                                                             |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Security                | 13.2  | **Merged (#456).** "Try again" works on every error page                                                   | S    | Finding 3                                                                                                                                        |
|                         | 13.3  | **Merged (#457).** A slow limiter store no longer lets public requests through                             | S    | Finding 4: a short timeout, and "timed out" counts as "store down"                                                                               |
|                         | 13.4  | **Merged (#461).** The route guard has its own tests                                                       | S    | Validation becomes a list of what counts, not what does not                                                                                      |
|                         | 13.5  | Sign-in limits are explicit                                                                                | S    | Better Auth custom rules for sign-in, magic link and the second factor                                                                           |
|                         | 13.6  | Rate-limit classes in the library                                                                          | M    | F-08                                                                                                                                             |
|                         | 13.7  | Every route names its class                                                                                | M    | Mechanical, about 166 routes; after 13.6                                                                                                         |
|                         | 13.8  | Content security policy with a nonce, in report-only mode                                                  | M    | A nonce makes every page dynamic (section 11): decide per app before building                                                                    |
|                         | 13.9  | Enforce the policy                                                                                         | S    | After 48 clean hours on staging                                                                                                                  |
|                         | 13.10 | **Open (#468), waits on O-2 to merge.** The boundary lint rules fail the build; frontends read from a list | S    | Found: no lint rule could fail a build (`only-warn`). `pnpm check:boundaries` replaces `check:api-first-actions`                                 |
|                         | 13.11 | The sign-up link stops carrying name and email                                                             | M    | Small screen change                                                                                                                              |
|                         | 13.12 | A decline reason comes from a fixed list                                                                   | S    | Screen change                                                                                                                                    |
|                         | 13.13 | **Open (#469), waits on O-2 to merge.** Code scanning and a bill of materials in CI                        | S    | CodeQL reports, it does not block. One CycloneDX file an app                                                                                     |
|                         | 13.14 | The app's database role cannot bypass row-level security                                                   | L    | From the expert pilot council; adds a migration                                                                                                  |
|                         | 13.15 | The security checklist is ticked, with a check that proves it                                              | M    | After 13.2 to 13.9                                                                                                                               |
| Observability           | 13.16 | Sentry knows the release and the environment                                                               | M    | Source maps, browser errors, O-3                                                                                                                 |
|                         | 13.17 | Every API request carries a reference into the audit trail                                                 | M    |                                                                                                                                                  |
|                         | 13.18 | **Open (#467), waits on O-2 to merge.** Every background job reports that it ran                           | S    | One list of 22 jobs, one wrapper, one reporter; no heartbeat exists yet                                                                          |
|                         | 13.19 | Monitors as code, and a health check that checks                                                           | M    | After 13.18, O-3. Reads `@eleva/config/background-jobs`; skips a job marked `notRegisteredUntil`; 22 heartbeats are more than the free plan's 10 |
|                         | 13.20 | Runbooks and final service levels                                                                          | S    | Docs                                                                                                                                             |
| Retention               | 13.21 | Ended invitations are deleted                                                                              | S    | P-02; a test for the 37-day floor                                                                                                                |
|                         | 13.22 | Unused guest accounts are anonymised                                                                       | M    |                                                                                                                                                  |
|                         | 13.23 | Stuck notices are retried; dead ones can be sent again                                                     | M    |                                                                                                                                                  |
|                         | 13.24 | Shipped audit rows leave the outbox after 90 days                                                          | S    |                                                                                                                                                  |
| Tests and CI            | 13.25 | A seeded database for e2e in CI                                                                            | M    | Today CI builds two apps with no database, so most signed-in specs skip                                                                          |
|                         | 13.26 | e2e split across machines, signed in once                                                                  | M    | After 13.25                                                                                                                                      |
|                         | 13.27 | The missing suites                                                                                         | M    | Expert onboarding, manual invoicing, language switch                                                                                             |
|                         | 13.28 | **Merged (#460).** Preview database branches expire by themselves                                          | S    | Lesson 2                                                                                                                                         |
| Speed and accessibility | 13.29 | Speed budgets on home, explorer and profile                                                                | M    | After 13.25                                                                                                                                      |
|                         | 13.30 | Bundle budgets and lazy loading                                                                            | M    |                                                                                                                                                  |
|                         | 13.31 | Public pages are cached                                                                                    | M    | Next 16 caching (section 11)                                                                                                                     |
|                         | 13.32 | Accessibility checks on the signed-in apps                                                                 | S    | After 13.25                                                                                                                                      |
| Languages               | 13.33 | API error codes map to copy in three languages                                                             | M    |                                                                                                                                                  |
|                         | 13.34 | **Open (#466), waits on O-2 to merge.** Every email renders in three languages                             | S    | A test (220 pass)                                                                                                                                |

Waiting on a person or an outside party: the penetration test and the DPO provider (F-14), the
retention periods (P-02), analytics (F-09), the limits (F-08), the accounts and the restore
drill (O-3, O-4). The retention sweep that already exists stays unscheduled until the DPO signs.

### Phase 14: moving the MVP's data

The order is safe by construction: count before writing, dry run before apply, one family of
data per slice, the same result when run twice, a report after each, a rehearsal on a database
branch before production.

| Id    | Title                                                                                                  | Depends on  | Size | Proof                                 |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------- | ---- | ------------------------------------- |
| N1    | Operator: confirm what production runs; a read-only role                                               | F-02        | -    | The role cannot write                 |
| 14.2  | **Open (#465), waits on O-2 to merge.** One guarded connection, and a command that only runs the guard | none        | S    | Exit-code tests                       |
| 14.3  | Inventory, read only: tables, counts, value shapes, no personal data in the output                     | N1          | M    | A committed counts report             |
| 14.4  | The migration's own tables: runs, id map, checksums                                                    | 14.2        | S    | Constraint tests                      |
| 14.5  | The dry-run frame: mapper contract, safe re-runs, a report                                             | 14.4        | M    | A fixture applied twice, same counts  |
| 14.6  | People and accounts without passwords                                                                  | 14.5        | M    | People in equals people out           |
| 14.7  | Organizations, Spaces, memberships                                                                     | 14.6        | S    | One fixture per kind                  |
| N2    | Operator: export names, verified flags and Google ids                                                  | N1          | -    | The export matches the people count   |
| 14.8  | Google sign-in from the export only                                                                    | N2, 14.6    | S    | Two runs, no duplicates               |
| 14.9  | Expert profiles, categories, listings, applications, public names                                      | 14.7        | M    | A reserved name stops the run         |
| 14.10 | Services, schedules, overrides                                                                         | 14.9        | M    | Addresses preserved                   |
| 14.11 | Bookings and their payments                                                                            | 14.10       | M    | No loss; time zones tested            |
| 14.12 | Payouts and legacy invoice rows                                                                        | 14.11       | M    | Every paid booking has a row          |
| 14.13 | Stripe check, read only                                                                                | 14.9        | S    | Every id found                        |
| 14.14 | Plans and kept commissions                                                                             | A-02        | S    | One fixture per plan                  |
| 14.15 | Session notes: decrypt, encrypt again, checksum                                                        | N1, F-11    | M    | Checksums match                       |
| 14.16 | Consents                                                                                               | P-05        | S    | One fixture per case                  |
| 14.17 | Files: from the MVP's storage to R2                                                                    | 14.9        | M    | Counts and sizes match                |
| 14.18 | Legacy audit rows                                                                                      | P-02        | S    | Counts match                          |
| 14.19 | Verify: counts, orphans, checksums, a sample of addresses                                              | 14.11       | M    | A planted orphan is found             |
| 14.20 | The rehearse command; rehearsal one                                                                    | 14.19, P-06 | S    | A rehearsal report                    |
| 14.21 | Changes since a date, with deletions; rehearsal two                                                    | 14.20       | M    | Edit, delete, run again               |
| 14.22 | Old private addresses redirect                                                                         | none        | S    | Redirect tests                        |
| 14.23 | The welcome email, in waves; the calendar notice                                                       | 14.6, F-10  | M    | A dry run prints who would receive it |
| 14.24 | The way back: reverse export, and a rollback rehearsal                                                 | 14.21       | L    | Replayed twice, no duplicates         |
| 14.25 | The cutover runbook, with a full-load step; rehearsal three                                            | all, F-10   | S    | A timed report                        |

What the code review of the MVP snapshot showed, to settle before the mappers: the MVP has no
passwords to move (people set a new one or use Google); no time zone on the person, while
schedules and meetings each carry one that the mappers must keep; timestamps stored without a
zone; one schedule per person; no status on a meeting; no practice country, languages
or licence fields; calendar tokens that are dropped (experts reconnect); files in storage that
Phase 14 does not mention; and no consent table. References `05-auth/12` and `13` cover "set a new
password" and "reconnect your calendar"; Mobbin had no "we have moved" screen.

### Phase 15: launch

| Id   | Title                                                                    | Size | Note                                                              |
| ---- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------- |
| 15.1 | The launch checklist as a table: owner, state, evidence                  | S    | Today it is a generic list with no owners                         |
| 15.2 | The cutover gate: a production command runs only with a dated approval   | M    | Unit tests for missing, stale and foreign approvals               |
| 15.3 | Production setup scripts, dry run by default                             | M    | Monitoring, video, email and SMS do not have one yet              |
| 15.4 | A production smoke test: read only, plus one €1 booking behind a switch  | S    | Depends on F-01 for the invoice step                              |
| 15.5 | The regulator pages for Portugal, linked from the footer                 | M    | In `@eleva/content`, not `apps/docs` as the phase file says; C-03 |
| 15.6 | A maintenance notice and a status link                                   | S    | Refs `09-trust/13`, `14`                                          |
| 15.7 | The impact assessment, the sub-processor list, every decision gate dated | S    | P-07                                                              |
| 15.8 | The cutover, operated step by step, then seven days of watching          | -    | From the 14.25 runbook; engineering never runs production steps   |

## 9. Owed from phases 01 to 10

These are not new work; they are proofs and signatures the earlier phases still owe.

- **Payments (06):** pay, transfer and payout shown on staging.
- **Invoicing (07):** issuing stays closed on purpose. Opening it needs the accountant's
  remaining conditions and the tax authority communication, run by the operator (F-01).
- **Video (09):** the two-browser session through Eleva's own join link, with Daily's webhooks,
  on staging.
- **Records (10):** the DPO's sign-off on retention and on the AI-processing copy (P-07).
- **Offer builder (04B):** the human evidence was waived, so it is unproven, not proven.
- **Others:** the SMS sender's EU setup, the consent banner's languages and its five browser
  journeys, Google's review of the sign-in screen (on staging until cutover), and the draft
  banners on three marketing pages (design slices D3.3 and D3.4).

## 10. Design: open slices and saved references

The design plan (`design-audit/plan.json`) has 21 slices open:

| Group                  | Open slices                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| D2 Trust in the person | D2.3 services and booking on the profile; D2.4 expert card and explorer; D2.5 report a concern               |
| D3 Homepage            | D3.1, D3.2 homepage; D3.3 become an expert; D3.4 for clinics and About                                       |
| D4 Expert activation   | D4.1 the expert door; D4.2 setup, rebuilt; D4.3 money, licence, finish; D4.4 sign-in polish                  |
| D5 Dashboards          | D5.1 expert Today; D5.2 member home; D5.3 privacy controls; D5.4 calendar and services; D5.5; D5.6 calendars |
| D6 Trust centre        | D6.1 trust centre and policy layout                                                                          |
| D7 Calm                | D7.6 service editor; D7.7 practice menu and home; D7.8 clinic and Academy without promises                   |

References saved on 2026-11-21 for the screens of sections 6 to 8. Each surface's
`references.json` holds the pattern, why it works, how to use it and a criterion for the panel.

| Screen                                | Slice          | References            | What Mobbin did not have                      |
| ------------------------------------- | -------------- | --------------------- | --------------------------------------------- |
| Choosing a plan priced per seat       | 11.8           | `11-team/14`, `15`    |                                               |
| Billing: plan, seats in use, invoices | 11.8           | `11-team/16`, `17`    |                                               |
| The seat limit, with a way up         | 11.9           | `11-team/18`          | A prompt that says what the bigger plan gives |
| Every session across the clinic       | 11.13          | `11-team/19`, `20`    |                                               |
| Experts side by side in a schedule    | 11.14          | `11-team/21`, `22`    |                                               |
| A sensitive setting, confirmed        | Shared records | `11-team/23`, `24`    | A written reason before turning it on         |
| The clinic's public page              | 11.17          | `03-profile/25`, `26` |                                               |
| A person: state, sessions, sign out   | 12.19          | `13-admin/04`, `06`   |                                               |
| Acting as someone else                | F-04           | `13-admin/07`, `08`   | A start that asks for a reason                |
| Notes only staff see                  | Phase 12       | `13-admin/09`, `10`   |                                               |
| A request waiting for a second person | 12.15          | `13-admin/11`, `12`   |                                               |
| Who did what, and when                | 12.18          | `13-admin/13`, `14`   |                                               |
| Failed deliveries, sent again         | 12.21          | `13-admin/15`, `16`   |                                               |
| Back after the move                   | 14.23          | `05-auth/12`, `13`    | A "we have moved" screen or email             |
| Planned maintenance, and status       | 15.6           | `09-trust/13`, `14`   | A full "back soon" page                       |

## 11. What the current docs say

From Context7 on 2026-11-21. Only the facts that change how a slice is built.

**Stripe** (`/websites/stripe`, `/stripe/stripe-node`, `/stripe/react-stripe-js`)

- Checkout Session `ui_mode` is `hosted_page`, `embedded_page`, `elements` or `form`. A
  subscription in our page is `mode: "subscription"` with `ui_mode: "embedded_page"`, mounted
  with `EmbeddedCheckoutProvider`. Nothing in the apps mounts it yet (11.8).
- `checkout.session.completed` does not mean paid. Give access on `invoice.paid`.
- A seat change is a subscription update with a proration choice. For an increase Stripe
  recommends `payment_behavior: "pending_if_incomplete"` with `always_invoice`; the code uses
  `default_incomplete` with `create_prorations` (A-03, 11.7).
- Stripe's docs say the customer portal cannot change a subscription that has more than one
  product. A clinic's subscription has two items (plan and seats), but our seed script puts both
  prices on one product, so the docs do not settle whether the portal can change a clinic's
  plan. 11.8 tries it in test mode first; if the portal refuses, the plan change is ours to
  build. Either way a portal configuration needs a product catalog before it offers a switch.
- Entitlements change with `entitlements.active_entitlement_summary.updated`. It is not in our
  webhook registry, nor are `invoice.finalized`, `invoice.finalization_failed` and
  `customer.tax_id.updated`. Adding an event means the three-file contract and the setup script.
- With an existing customer, saving a VAT number from Checkout needs `customer_update`. EU VAT
  numbers are checked against VIES after the fact; the result arrives by webhook.
- Webhooks arrive in any order and more than once: find or create, and record handled ids.

**Better Auth** (`/better-auth/better-auth`, docs at 1.7.15)

- The API-key plugin replaced `userId` with `referenceId` (finding 1).
- The second-factor plugin challenges only password sign-in. Magic link, Google and passkey are
  not challenged, and there is no built-in re-check before a sensitive action. 12.8 and 12.9
  build both.
- There is no option for a host-only (`__Host-`) cookie, and one instance has one cookie scope.
  12.11 starts with a spike.
- A ban also signs the person out everywhere. Impersonation lasts one hour and marks the session
  with `impersonatedBy`.
- Rejecting an invitation sets a status and stores no time, which is why the 30-day wait is
  counted from the invitation's expiry.
- Not found in Context7: the order of global hooks, plugin hooks and endpoint middleware. The
  staff guard depends on it, so 12.5 proves it with a test.

**Next.js 16.4** (`/vercel/next.js/v16.4.5`)

- `proxy.ts` runs on Node only and is for quick cookie checks, not for database calls.
- A content security policy with a nonce needs every page rendered per request. For the public
  site that costs caching; the alternative is hash-based and experimental (13.8).
- Error pages receive `retry` and `reset` (finding 3).
- `revalidateTag` now takes a profile; `updateTag` is for Server Actions; `"use cache: private"`
  is the form for signed-in data (13.31).

**Neon** (`/websites/neon`)

- A rehearsal branch is created from production, reset from its parent and deleted with one
  command each; a restore drill is a branch created at a past time (O-4, 14.20).
- Plans include ten branches (Free, Launch) or twenty-five (Scale); temporary branches should
  carry an expiry (13.28, O-2).
- A masked copy of production is a documented feature (P-06). Resetting it from its parent
  brings the real data back, so masking runs again after every reset.

**Upstash** (`/websites/upstash_redis_sdks_ratelimit-`, `/websites/upstash_qstash`)

- A rate-limit call that times out (five seconds by default) answers "allowed" with
  `reason: "timeout"` (finding 4). No fail-closed option is documented: check the reason.
- QStash retries three times by default, then the message goes to a dead-letter queue from which
  it can be sent again (12.21).

**Sentry** (`/websites/sentry_io_platforms_javascript_guides_nextjs`, repo on v10)

- The repo has no `withSentryConfig` and no browser init, so there are no source maps and no
  browser errors (13.16). The next major version collects cookies and bodies by default and drops
  a hook the repo uses: upgrade only with an explicit restrictive setup.

**Playwright** (`/microsoft/playwright/v1.56.1`)

- Sign in once in a setup project and reuse the stored state; split with `--shard` and merge the
  reports; check accessibility with `@axe-core/playwright` (13.25, 13.26, 13.32).

**Vercel** (`/websites/vercel`)

- A production deployment can be built without taking the domain, checked, then promoted; a
  rollback repoints the domain in seconds. A domain moves between projects of one team with a
  "move" action and must not be deleted first. A no-downtime guarantee is not documented (15.8).

**Resend** (`/websites/resend`)

- The welcome email after the move is an announcement to a list, not a reply to an action:
  a broadcast, with an unsubscribe link. Batches hold 100 emails. Hard bounces and complaints
  suppress an address, with an `email.suppressed` event our webhook does not handle (14.23).

## 12. What this review did not check

- Anything running: no browser, no database, no Stripe, Neon, Sentry or Vercel account.
- Whether the Stripe products, portal and webhooks exist in any account, and which API version
  is deployed.
- What the production MVP database holds: counts, quality, time zones, which provider.
- The statuses in sections 6 to 8 beyond the six findings checked by hand. They come from
  reviewer agents reading code, with a file for each; treat a surprising row as a lead.
- Sizes and the order of waves: they are a proposal for the founder to change.
