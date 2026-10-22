# Consent (c15t / Inth) — manual verification checklist

Engineering mounts `@eleva/consent` on all user-facing apps with strict opt-in, Eleva theme tokens, and `ELEVA_LOCALE` passed to `resolveConsent({ language })`. This checklist is **evidence for handoff**, not a legal compliance stamp. Run against a **production build** (`next build && next start`), not dev-only HMR.

**Backend:** Inth org `eleva`, project `eleva-care`, runtime `https://eleva-care-eleva.inth.app/` (Frankfurt). **Do not** bump `CONSENT_DOCUMENT_VERSION` until founder/DPO re-sign legal.

## Browser setup

1. Fresh private/incognito profile (no prior `c15t` cookie).
2. DevTools → Network: **Disable cache**, **Preserve log**.
3. Note optional vendor domains you expect gated (Beehiiv embed, future analytics). Mux was removed from marketing video; no Mux consent gate.

## Five journeys (from [c15t verify guide](https://c15t.com/docs/guides/verify-consent))

| #   | Journey                     | Pass criteria                                                                                                     |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | First visit (opt-in region) | Banner visible; no optional vendor requests before choice; Inth `/init` or consent route succeeds                 |
| 2   | Reject all                  | Banner closes; reload + new tab: no banner (stored deny); still no optional requests                              |
| 3   | Accept all                  | Only categories you allow load vendors; check Network after save                                                  |
| 4   | Withdraw                    | Footer **Cookie settings** opens dialog; turn off a category → save → page reloads; vendor stays off after reload |
| 5   | Granular + a11y             | Partial accept; keyboard through banner/dialog; narrow viewport (~320px); focus trap sane                         |

## Locale

Switch `ELEVA_LOCALE` (footer language switcher on marketing) to **pt** and **es**, reload: banner strings should follow locale (Inth copy + `@eleva/consent` `consent-i18n` overrides).

## Inth dashboard

After each save, confirm a consent record appears in [Consent overview](https://inth.com/dashboard/eleva/eleva-care/consent/overview) (staging/dev origins only if trusted origins allow).

## Record results

| Date       | Tester                    | Build / URL                                                      | Journeys 1–5                                            | Locale pt/es | Inth records | Notes                                                                                                    |
| ---------- | ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------------ | ------------ | -------------------------------------------------------------------------------------------------------- |
| 2026-10-22 | Agent (automated partial) | `next build && ELEVA_CONSENT_TEST_COUNTRY=DE pnpm start` @ :3000 | 1–2 partial via `e2e/consent-smoke.spec.ts`; 3–5 manual | Not run      | Not checked  | Reject + cookie settings PASS with test geo; production needs real geo headers or `c15tProxy` on gateway |
