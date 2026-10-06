# UX and design defect inventory (2026-10-06)

Baseline for the brand evolution (WP2) and app-by-app redesign (WP3/WP4) of the
phases 01–08 production pass.

**Method and limits.** This pass is a source review of every product app on `main`
(web, account, app, expert, team, academy, admin, docs). A browser walkthrough with
screenshots was attempted on 2026-10-06 but the local machine could not run the dev
servers and the browser at the same time (screenshots timed out). Screenshots, mobile
viewport checks, dark-mode visual checks and axe runs move to WP5 and are **pending**,
not passed. Severity: **P1** blocks a credible launch, **P2** visibly hurts quality,
**P3** polish.

## Cross-cutting

| ID     | Sev | Area          | Finding                                                                                                                                                                                                                                | Fix lands in      |
| ------ | --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| UX-001 | P1  | States        | No app has a `loading.tsx`, `error.tsx`, `not-found.tsx` or `global-error.tsx` (0 of 69 pages across 8 apps). Slow data fetches show a blank page; thrown errors show the Next.js default screen; unknown routes show the default 404. | WP3 shared states |
| UX-002 | P2  | Brand tokens  | `--chart-1`…`--chart-5` in `@eleva/ui/globals.css` are the shadcn lime default (hue ≈ 130) in both light and dark. Charts on finance surfaces do not use the brand teal/coral.                                                         | WP2 kit           |
| UX-003 | P2  | Typography    | `apps/web` and `apps/docs` root layouts do not apply `fontClassName` from `@eleva/ui/fonts` (Lora / DM Sans / Plex Mono). The marketing site and docs render in the fallback stack while product apps use the brand fonts.             | WP2 kit           |
| UX-004 | P2  | Components    | `@eleva/ui` ships `Empty` and `Skeleton`, but no product page imports them. Empty lists use ad-hoc paragraphs and loading uses nothing (see UX-001).                                                                                   | WP2 kit + WP3     |
| UX-005 | P2  | Feedback      | Toasts (`sonner`) are used for most saves, but the expert schedule editor still shows an inline "saved" `Alert` (`schedule/schedule-editor.tsx`). One pattern per AGENTS.md: toasts for transient success.                             | WP4 expert        |
| UX-006 | P3  | Images        | Marketplace avatars use raw `<img>` (`[username]/page.tsx`, `experts/explorer.tsx`) with lint suppressions. Decorative `alt=""` is correct, but there is no sizing/optimisation (LCP on the explorer).                                 | WP4 web           |
| UX-007 | P3  | Dark mode     | Hard-coded palette classes outside the token system remain in `expert/calendar/week-view.tsx` (3) and `dashboard/nav-user.tsx` (2). Everything else in product apps reads semantic tokens.                                             | WP3 / WP4 expert  |
| UX-008 | P3  | Copy (PT)     | Account "Create workspace" is "Criar workspace" (PT) / "Crear workspace" (ES): untranslated loanword. Work organizations may say workspace in EN, but PT/ES should read natively (e.g. "Criar espaço de trabalho").                    | WP4 account       |
| UX-009 | P3  | Accessibility | Only 6 `role="alert"` regions exist: 5 on auth/onboarding forms and 1 on expert event-type actions. Settings and expert forms rely on toasts alone for errors; validation errors need inline, announced messages next to the field.    | WP3 form patterns |

## Per app

### apps/web (13 routes)

- **P1 — Draft pages still public:** `become-expert`, `for-clinics`, `contact`, `legal/[slug]` and
  `trust/[slug]` render `MarketingDraftPage` with an amber "draft" banner. Legal and trust
  pages stay draft until D-06 / D-12 legal sign-off. Never mark them final in code before
  that. Become-expert, for-clinics and contact can be finished in WP4.
- **P2 — Booking funnel** (`[username]/[eventSlug]`, `book/[token]`): carries the policy, price and
  consent UI from Phase 04B/06, but uses no shared skeleton between slot fetch and render (UX-001).
  Redesign against the kit in WP4.
- **P3 — Expert profile / explorer:** avatar fallback is a bare initial on `bg-muted`. Use the kit
  `Avatar` with brand-tinted fallback and the verified badge (WP2 `VerifiedBadge`).

### apps/account (17 routes)

- **P2 — Auth screens** (login, signup, reset, two-factor, passkey) are functional and announce errors,
  but have no brand panel or illustration. They are the first impression for members.
- **P3 —** UX-008 workspace copy. Settings uses toasts correctly.

### apps/app — member (8 routes)

- **P2 — Sessions list and detail:** no empty state when a member has no sessions (UX-004). Session
  detail now shows invoice status (AUD-022, #140), but the "Join" button is permanently disabled
  with a "join soon" note until Phase 09 video.
- **P3 — Payments / privacy / notifications:** consistent but plain `dl` / table layouts. Align to the
  `PageHeader` + `Section` primitives.

### apps/expert (24 routes, incl. team mirrors)

- **P2 — Onboarding (`setup`)** follows one goal per step (Airbnb-style), but steps share no progress
  shell visual beyond the stepper. Redesign in WP4.
- **P2 —** UX-005 schedule editor inline alert; UX-007 calendar week view colours.
- **P3 — Finance** charts inherit the lime chart tokens (UX-002).

### apps/team (3 routes), apps/academy (2), apps/admin (1)

- **P3 —** Thin surfaces (team inbox shipped in #89; academy and admin are placeholders until their
  phases). Align header, empty and error states to the kit only. Phase 12 owns the admin console.

### apps/docs (1 route + MDX)

- **P2 —** UX-003 fonts. The planned `/docs/design-system` showcase does not exist yet (WP2).

## Assets to mine (reference only, `_context/clone-repo/eleva-care-app`)

Wordmark SVG, verified-expert icon, OG image layout, email header/footer components and voice
samples. Copy them into `@eleva/ui` / `@eleva/email` in WP2; never import from `_context/`.

## Pending verification (WP5)

Screenshots per app (light and dark, 375 px and 1280 px), axe checks on every e2e page, and Lighthouse
on `apps/web` (target ≥ 90). None of these are claimed here.
