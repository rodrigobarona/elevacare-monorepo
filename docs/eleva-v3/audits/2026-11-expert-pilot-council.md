# Expert pilot review council (2026-11-05)

**Milestone scored.** Experts who use the MVP today (`eleva-care-app`) come to v3 on
staging (`dev.eleva.care`) and test it with their real accounts: sign-up, setup, services,
schedules, calendars, Stripe Connect (test mode), bookings, video, notes and reports,
finance and licence review. This is **not** the production launch (Phase 15).

**Bar.** Each discipline must reach **≥ 8.0** and no P0/P1 may stay open before the first
real expert is invited. The gate is recorded in
[`decision-log.md`](../decision-log.md) (2026-11-06: Expert pilot invitation gate). The gate is recorded in
[`decision-log.md`](../decision-log.md) (2026-11-06: Expert pilot invitation gate).

**Method and limits.** The council has nine reviewers: three for UX/UI, three for security
and three for privacy and health. Each one reviewed the code and docs on `main` at
`6e976390` through a separate specialist lens, using the same 0–10 rubric:

- 10 = best in class, with evidence
- 8 = ready for a closed pilot, no P0/P1 open
- 6 = works, with notable gaps
- 4 = major gaps

Anything that needs live proof (screenshots, pentest, real OAuth, signed DPAs) was capped
at 7 when no evidence exists.

The reviewers are AI agents applying these specialist lenses. They are **not** a substitute
for human sign-off: the DPO, legal counsel, an external pentest and founder decisions are
still required where the findings name them. The P0 security findings were re-verified by
hand before any fix was made.

## Scores

| Discipline           | Reviewer lens                            | Score   |
| -------------------- | ---------------------------------------- | ------- |
| UX/UI                | UX-1 Expert journey (Airbnb / Cal.com)   | 5.8     |
| UX/UI                | UX-2 Design system & WCAG 2.2 AA         | 6.1     |
| UX/UI                | UX-3 Content, i18n & member funnel       | 7.1     |
| **UX/UI**            | **average**                              | **6.3** |
| Security             | SEC-1 API security & authorization       | 5.0     |
| Security             | SEC-2 Identity, sessions & cryptography  | 6.3     |
| Security             | SEC-3 Platform, supply chain & SecOps    | 4.7     |
| **Security**         | **average**                              | **5.3** |
| Privacy & health     | PRIV-1 GDPR / DPO                        | 5.1     |
| Privacy & health     | PRIV-2 Health data & clinical governance | 6.2     |
| Privacy & health     | PRIV-3 Consent, ePrivacy, consumer & AI  | 6.5     |
| **Privacy & health** | **average**                              | **5.9** |
| **Overall**          |                                          | **5.9** |

No discipline meets the bar. Engineering foundations score well: envelope encryption,
webhook verification, storage design, PHI-safe logging, i18n parity and the booking
consent model. The gaps fall in four groups:

1. Authorization holes and outdated dependencies (fixed first, below).
2. Expert-side workflow gaps an MVP expert would notice on day one.
3. Accessibility basics in the booking funnel.
4. The legal and operational frame for putting real people's data on staging.

## Wave 0 — security P0s (engineering, merged)

An engineering finding counts as closed only once its fix is merged **and** deployed to
`dev.eleva.care`. A legal or operational finding (signed DPAs, adopted procedures, named
contacts) closes on documented evidence approved by its owner. All four fixes are merged on `main` (2026-11-06); deployment to `dev.eleva.care` is not yet
verified, so they stay "merged" rather than "closed". Extra closure conditions:

- **SEC1-01 / SEC1-02:** fixing the code does not revoke grants already obtained through it.
  Before either closes, review on staging (and any other environment that ran the vulnerable
  code) the existing admin memberships, `staff` organizations, and every membership, role change
  and pending invitation created by an admin, and revoke any not granted by Eleva or the
  organization's real owner.
- **SEC3-01/02:** closes only after the opt-in sign-in e2e passes against Better Auth 1.7.18
  and magic link, Google and passkey sign-in are each verified by hand on `dev.eleva.care`.

The pilot invitation stays blocked until these checks are done.

| ID         | Finding                                                                                             | Status                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| SEC1-02    | `POST /memberships` let any signed-in user join any org as admin                                    | Merged in [#301](https://github.com/rodrigobarona/elevacare-monorepo/pull/301): route removed                      |
| SEC1-01    | `staff` org type was client-settable (create and update), which granted platform staff capabilities | Merged in #301: schema, domain type and Better Auth org hooks                                                      |
| SEC1-03    | Event-type PATCH accepted `published: true`, skipping the publish gates                             | Merged in #301: strict schema, 422                                                                                 |
| SEC3-01/02 | Better Auth 1.7.3 (OAuth-state-as-magic-link takeover) and Next.js 16.2.6 (proxy bypass, image RCE) | Merged in [#302](https://github.com/rodrigobarona/elevacare-monorepo/pull/302): Better Auth 1.7.18, Next.js 16.4.5 |

## Wave 1 — remaining P1s before the first expert is invited

**Security (engineering)**

- SEC2-01/02: implicit same-email Google linking (with `requireLocalEmailVerified: false`)
  enables account pre-hijacking, and lets anyone who gains control of the email domain take over
  accounts — **including already-verified ones**. Acceptance:
  - linking a new identity to an existing account requires the existing owner to authenticate
    first (sign in with a current factor, then `linkSocial()`), for verified and unverified rows;
  - an unverified row is claimed by proof of email ownership alone; the claim purges its password,
    passkeys, two-factor secrets, backup codes and any social identities (Google, Microsoft)
    linked before verification, and revokes its sessions (anything enrolled before verification
    is treated as attacker-controlled);
  - on a verified account with MFA, email-only recovery (magic link, password reset) asks for the
    second factor;
  - the user is notified on every newly linked identity.

  Status 2026-11-06: the first two items are implemented for provider claims (Google, Microsoft) (decision log, "Owner-first account
  linking"), pending deploy and a sign-in check on `dev.eleva.care`. The MFA-on-recovery and
  notification items are still open.

- SEC2-03: MFA is optional and skipped on magic link, Google and passkey. Any account with MFA
  enrolled (staff or not) must complete the second factor on every sign-in path that is not
  itself a second factor (magic link, password, Google). A passkey counts as a second factor only
  when the sign-in required user verification (PIN or biometric); today `packages/auth` does not
  require it. Enforce MFA for staff roles and add step-up for money, credential and privacy
  actions.
- SEC1-04: runtime DB role bypasses RLS. Use a non-bypass app role with narrow service policies.
- SEC3-03: audit trail is not append-only. Use a dedicated insert-only role, a blocking
  trigger, the hash chain, and a separate Neon project as documented.
- SEC3-04/05: add Renovate and a CI `pnpm audit` gate; apply `withHeaders` to `apps/web` and
  `apps/docs`.
- SEC3-06/07: confirm PITR, run a restore drill and set up KEK escrow; adopt the breach
  procedure with named owners and alert routing.

**UX/UI (engineering)**

- UX1-01: Back links from the join and report pages lead to the public funnel.
- UX1-02: named schedules cannot be given hours.
- UX1-03: there is no bookings list (past, cancelled, all), while the MVP had one.
- UX1-04: the week view drops sessions outside 07:00–21:00 and is not usable on mobile.
- UX1-05: experts have no cancel or reschedule path (at minimum, a request to support).
- UX2-01..04: unlabelled funnel inputs (WCAG Level A); focus rings below 3:1; focus not
  moved on step change; slot picker not announced.
- UX2-05: axe does not scan the expert, member or funnel screens.
- UX3-01..04: expert emails greet the member and use the member's locale; member emails do not
  name the expert, the amount paid or the policy; an internal video-vendor compliance note
  appears in member copy.

**Privacy and health (founder, DPO and legal, with engineering support)**

- PRIV1-01 / PRIV2-01 (P0): no legal frame for real people's data on staging. This needs a
  founder decision-log entry "Expert pilot" (named experts, member cap, data categories,
  recording off), a pilot participation agreement plus a privacy addendum, a DPIA
  pilot addendum, and isolation of pilot data from PR and preview branches.
- PRIV1-02 / PRIV3-02: expert agreement and DPA are never presented or accepted. Add a
  versioned acceptance at the last setup step.
- PRIV1-04/08/09: vendor DPAs in the company's name; a named interim privacy contact; an
  adopted breach procedure.
- PRIV1-05/06/07: DSAR and erasure gaps (phone, NIF, intake, transcripts, Resend, Stripe);
  expert offboarding; notices that contradict each other and the code.
- PRIV2-02: profiles that are already listed stay bookable without licence verification.
- PRIV2-03: no crisis or emergency signposting where members are.
  Status 2026-11-11: 112 and the national lines (SNS 24 and 1411 in
  Portugal, 024 in Spain) are shown on the booking details step, the
  thank-you page, the member's session page and member emails (decision
  log, "Urgent help is signposted where members book and wait"). Open
  until deployed, until the join page carries it, and until the founder
  and Patricia Mota have read the choice of lines.
- PRIV2-04: expert record reads are only sampled at 1%. Lei 58/2019 expects a full access log.
  Status 2026-11-11: every read of a session record is audited, the owning
  expert's too (decision log, "Every read of a session record is logged").
  Open until deployed.
- PRIV2-05: the clinic and CRM RLS suites are not in CI; correct the AUD-052 stamp.
  Status 2026-11-11: both suites run in the `neon-branch-migrate-and-rls` job.
  The AUD-052 stamp in the phases 01-10 audit now says when the suite
  started running in CI. The job is not yet a required check on `main`
  (founder: add `neon-branch-migrate-and-rls` to branch protection).
- PRIV2-06: live transcription relies on an unverified EU-processing claim. Keep it off for
  the pilot or get written confirmation.
- PRIV3-01: "Rating" sort is paid placement.
- PRIV3-03: no trader or licence disclosure at the point of sale.
- PRIV3-04: cookie policy is inaccurate.

## Re-score protocol

After each wave, the same nine lenses re-review the changed areas only and update their row
above. Each update records the commit it was scored at. The pilot invite goes out only when
all three discipline averages are ≥ 8.0 and no P0/P1 above remains open. This audit grants no
waivers; any exception would be a separate, dated `decision-log.md` entry by the named owner.
