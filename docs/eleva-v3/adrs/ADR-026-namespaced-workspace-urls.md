# ADR-026: Every workspace lives under a fixed namespace

## Status

Accepted (founder brief + four-judge panel, 2026-11-16). Amends ADR-014 (multi-zone rewrites) for
signed-in surfaces. Pre-launch: breaking URL changes ship without redirects.

## Date

2026-11-16

## Context

Signed-in surfaces shared the root with public profiles, so the address alone did not say what a
page was:

| Surface                        | Before                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Member hub (apps/app)          | `/space-3d4f155f88c8/sessions` (`space-` + 12 hex of the user id) |
| Expert dashboard (apps/expert) | `/patricia-mota-pt/team/...` (the `/team` suffix meant "expert")  |
| Clinic dashboard (apps/team)   | `/{slug}/admin/...`                                               |
| Academy (apps/academy)         | `/{slug}/academy/...`                                             |

The gateway needed a database lookup of the organization type on each request to tell a public
profile from a dashboard. Nothing stopped one person from creating several expert practices, and
there was no way to close one.

## Research

- Mobbin: Instagram turns one account into a "professional account"; Upwork keeps one freelancer
  profile with up to two "specialized profiles" for other specialties; Whereby separates
  "Personal account" from organizations; Deputy and Sketch list many businesses or workspaces.
- Patterns elsewhere: LinkedIn `/in/{user}` + `/company/{slug}`, GitHub `/orgs/{org}/settings`,
  Airbnb `/hosting` (one host mode per account), Udemy `/user/{slug}` public + `/instructor`
  dashboard, Doctolib one practitioner record with a primary specialty and a list of specialties.
- Next.js multi-zones guide: route each zone by a fixed path prefix with static rewrites, which is
  faster than per-request proxy logic.

## Panel

Four independent judges (information architecture/UX, UX writing EN/PT/ES, trust/legal/a11y,
platform engineering/SEO/security) scored every candidate and cast one vote per question.

| Question                       | Votes                                  | Decision                                    |
| ------------------------------ | -------------------------------------- | ------------------------------------------- |
| Member hub prefix              | `space` 4/4; no slug 4/4               | `/space`                                    |
| Expert dashboard prefix        | `expert` 4/4                           | `/expert/{slug}`                            |
| Team (clinic) dashboard prefix | `team` 4/4                             | `/team/{slug}`                              |
| Academy lecturer prefix        | `academy` 2, `teach` 1, `instructor` 1 | `/academy/{slug}`                           |
| Expert practices per person    | one, 4/4                               | one practice, many specialties and services |
| Closing a practice             | close, never delete, 4/4               | guarded close with a dry run                |

Rejected, with the reason the judges gave: `/personal` reads as "staff" in Spanish; `/care`
repeats the domain and tells a shared device that the person uses health care; `/practice` is a
false friend (prática/práctica = exercise); `/specialist` implies the Ordem "especialista" title;
`/clinic` implies an ERS-registered establishment; `/lecture` reads as "reading"
(leitura/lectura). `/teach` scored highest on totals for the academy (30 vs 27.5) and stays the
fallback if a public catalogue later needs `/academy`.

## Decision

1. **Public stays at the root.** `/{username}` and `/{username}/{service}` (apps/web) do not change.
   This is the only address meant to be shared.
2. **Signed-in surfaces sit under a fixed first segment:**

   | Namespace  | App          | Shape                                                                                                         |
   | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
   | `/space`   | apps/app     | `/space`, `/space/sessions`, `/space/reports/{id}` (no slug: one Space per person, resolved from the session) |
   | `/expert`  | apps/expert  | `/expert/{slug}`, `/expert/{slug}/calendar`                                                                   |
   | `/team`    | apps/team    | `/team/{slug}`, `/team/{slug}/members`                                                                        |
   | `/academy` | apps/academy | `/academy/{slug}`                                                                                             |
   | `/account` | apps/account | `/account/settings` (unchanged)                                                                               |

3. **The gateway dispatches on the first segment only.** No organization-type lookup per request.
   A bare `/{username}` is always the public profile.
4. **One slug registry.** Usernames and org slugs share one global namespace, so `/{x}`,
   `/expert/{x}` and `/team/{x}` can never belong to different owners. `space`, `expert`, `team`,
   `academy`, `teach` and `instructor` are reserved.
5. **Same sub-route words everywhere:** `settings`, `members`, `sessions`, `calendar`, `finance`.
   Settings live at `/{namespace}/{slug}/settings`.
6. **The org header comes from the second segment.** `x-eleva-org` is read from `/{namespace}/{slug}`;
   the API checks membership and that the org type matches the namespace, and answers 404 (not 403) on a mismatch so slugs cannot be probed. `/space` sends no header.
7. **Last active workspace.** `eleva-last-org` stores `space` for the person's own Space or the
   workspace slug from `/expert/{slug}` (and later `/team/{slug}`, `/academy/{slug}`); every zone's
   auth proxy writes it. `/dashboard` checks it against the person's memberships before
   redirecting and falls back to their own session.
8. **Dashboards are never indexed.** The gateway sends `X-Robots-Tag: noindex` and a strict
   referrer policy on every signed-in namespace, `/join`, `/account` and `/onboarding`. No PHI and
   no booking subject ever goes into a URL.
9. **One expert practice per person.** A practice carries several specialties and services, each
   tied to its own verified licence. A separate legal entity or NIF is a Team with a company
   billing profile, not a second practice. Delegates and clinic invitations are memberships in
   someone else's organization and never create a practice. A person may belong to any number of
   teams.
10. **An expert closes a practice; nobody self-deletes one.** Settings offer "Close your practice":
    - `GET /expert/closure/readiness` returns blockers with fixed codes (future bookings, pending
      refunds, open disputes, unsettled payouts, unpaid platform fees).
    - `POST /expert/closure` (idempotency key, step-up auth, typed slug confirmation, `withAudit`)
      unpublishes the profile, stops new bookings and delegate access, and keeps invoices (10 years),
      the Stripe Connect account, the audit trail and encrypted session records for their retention
      periods. Members keep access to their own records.
    - The username is held, never handed to another person while retention runs.
    - Erasure happens later, by schedule, after retention ends.

## Delivery (short sequential PRs)

1. **Shipped (#407).** ADR + expert namespace: `/expert/{slug}`, delete the `[orgSlug]/team`
   duplicate tree, fix the broken partner-decision and "no access" links.
2. **Shipped.** Member hub `/space` without a slug (the personal org slug is internal), static
   dispatch with no org-type lookup, `/space` resolved from the session for `x-eleva-org`, and the
   last-org cookie remembering `space` or the expert slug in every zone.
3. Team namespace `/team/{slug}` and academy namespace `/academy/{slug}`.
4. noindex + referrer headers on signed-in namespaces; migrate stored notification hrefs.
5. One practice per person (API guard + unique index).
6. Expert settings page and the closure API.

## Consequences

- Every address now says what it is, and the gateway does no database work to route.
- The `~` escape hatch is no longer needed for signed-in surfaces.
- Old addresses stop working with no redirects (dev mode); stored notification links are migrated.
