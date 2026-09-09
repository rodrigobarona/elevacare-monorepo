# POC A — Chapter Sidebar

Route: `/expert-onboarding/poc-a` · Registry: `apps/poc/src/domains/expert-onboarding/lib/registries/poc-a-steps.ts`

Airbnb Experience–style flow: pre-wizard → 7 sidebar chapters → post-submit hub.

---

## Pre-wizard (no sidebar)

| Step ID | Goal | Next enabled |
|---------|------|--------------|
| `p1-specialty` | Pick specialty category | 1 grid selection |
| `p2-sub` | Pick sub-focus | 1 chip |
| `p3-country` | Where you practice | Listed countries + companion map (world → country) |
| `p4-city` | City | City search + map zooms to city (`cityGeocoded` required) |
| `p5-intro` | Team review interstitial | always |
| `p6-name` | Workspace name | min 3 chars |

## Chapter 1 — About you

| Step ID | Goal |
|---------|------|
| `1-0-about` | Interstitial |
| `1-1-years` | Years in field (stepper) |
| `1-2-cards` | Credential cards overview |
| `1-3-title` | Professional title |
| `1-4-qual` | Qualifications — write in native language, EN/PT/ES on one screen |
| `1-5-recog` | Recognition (optional) — same localized editor |
| `1-6-linkedin` | LinkedIn (optional) |

## Chapter 2 — Location

| Step ID | Goal |
|---------|------|
| `2-0-location` | Interstitial |
| `2-1-address` | Meeting address (companion map → street level) |
| `2-2-map` | Confirm pin (interactive pan on companion map) |
| `2-3-format` | Session format chips |

## Chapter 3 — Photos

| Step ID | Goal |
|---------|------|
| `3-0-photos` | Interstitial |
| `3-1-upload` | Upload min 5 |
| `3-2-cover` | Pick cover photo |

## Chapter 4 — Public profile

| Step ID | Goal |
|---------|------|
| `4-0-profile` | Interstitial |
| `4-1-langs` | Session languages — EN, PT, ES cards on one page |
| `4-2-headline` | Headline — native language + AI translate, all locales on one page |
| `4-3-bio` | Bio — same localized editor (multiline) |

## Chapter 5 — First session

| Step ID | Goal |
|---------|------|
| `5-0-event` | Interstitial |
| `5-1-event-title` | Session title — localized field (all languages on one page) |
| `5-2-event-desc` | Description — localized field (multiline) |
| `5-3-duration` | Duration stepper |
| `5-4-summary` | Read-only summary |

## Chapter 6 — Pricing

| Step ID | Goal |
|---------|------|
| `6-0-pricing` | Interstitial |
| `6-1-price` | Price stepper |
| `6-2-earnings` | Earnings breakdown |
| `6-3-offers` | Intro discount yes/no |

## Chapter 7 — Trust & publish

| Step ID | Goal |
|---------|------|
| `7-1-telehealth` | Telehealth yes/no |
| `7-2-insurance` | Insurance yes/no |
| `7-3-tax` | Tax ID |
| `7-4-license` | Professional registration |
| `7-5-terms` | Terms checkbox |
| `7-6-review` | Dark review checklist |
| `post-submit` | Post-submit hub |

[← Domain hub](../../readme.md)
