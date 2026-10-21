# Eleva.care v3 Content And SEO Spec

Status: Living

## Purpose

This document defines the content and SEO direction for Eleva.care v3.

It should guide:

- marketing information architecture
- expert marketplace discoverability
- docs and editorial strategy
- localized metadata and structured data
- content ownership boundaries

## Content Principles

- Content should support trust, discovery, and conversion.
- Public content should reinforce Eleva's digital health platform positioning.
- SEO should support both brand growth and expert marketplace discovery.
- Docs and content should be docs-first and markdown-friendly.
- AI-readable content surfaces should be intentional, not accidental.

## Content Surfaces

### Marketing site

Includes:

- homepage
- value proposition pages
- trust and legal pages
- expert onboarding / become an expert
- organization pages

### Marketplace content

Includes:

- category pages
- expert profile pages
- search/filter landing views
- public booking entry points

### Docs / help content

Includes:

- product help
- educational guides
- support/reference content

### Editorial content

Includes:

- evidence and methodology pages (`/evidence-based-care`)
- the Femme Focus newsletter (Beehiiv), the podcast and the community,
  surfaced through `/newsletter`, `/podcast` and `/community`

There is no on-site blog (decision 2026-10-21). Newsletter issues live on
Beehiiv; the site links out to them.

## SEO Goals

The initial SEO program should support:

- branded discoverability
- category-level discoverability
- expert profile indexing where appropriate
- trust and compliance clarity
- high-quality structured metadata

## Recommended Ownership

### `apps/web`

Should own:

- marketing pages
- marketplace discovery pages
- expert public profiles
- public metadata generation

### `apps/docs`

Should own:

- help and docs content
- product documentation
- future public reference content

## Content Model Guidelines

The system should support content entities such as:

- page
- article
- guide
- category landing page
- expert profile content
- legal/trust content

Content should remain easily editable and versioned.

### Where content lives (decision 2026-10-21)

- **Long-form MDX** lives in `packages/content` (`@eleva/content`):
  `content/legal`, `content/trust`, `content/pages` (for example
  `evidence-based-care`) and `content/help/{members,experts,clinics}`.
  Each document has one file per locale and Zod-validated frontmatter.
  `apps/web` renders legal, trust and pages; `apps/docs` renders help.
- **Landing pages** (home, about, become-expert, for-clinics, history,
  newsletter, podcast, community) are TSX on `@eleva/ui` blocks with copy
  in `apps/web/messages/*.json`.
- **CMS readiness**: pages read content only through the `@eleva/content`
  loader (`getDocument`, `listDocuments`, `getTree`), so a CMS can replace
  the MDX source without page rewrites.

## Localization

The platform should support:

- `en`
- `pt`
- `es`

with `en` as-needed and localized content where it matters most.

Localization should apply to:

- metadata
- marketing pages
- booking-facing content
- marketplace filters and labels
- in-person location descriptions where relevant

## Metadata Requirements

The public web/docs stack should support:

- canonical metadata
- Open Graph metadata
- localized titles/descriptions
- sitemaps
- robots controls
- structured data / JSON-LD
- LLMs.txt and related bot-readable surfaces where useful

## Marketplace SEO

Marketplace SEO should focus on:

- category pages
- expert profile pages
- high-quality filterable discovery
- trust-rich public pages

It should avoid low-value thin pages created only for traffic.

## Expert Profile Content

Expert profile pages should balance:

- conversion
- trust
- discoverability
- compliance-safe messaging

Profile content should make room for:

- specialties
- languages
- locations/countries of work
- modalities
- trust and verification signals
- availability highlights

## Docs Strategy

Fumadocs is used headless (`fumadocs-core` + `fumadocs-mdx`) for:

- help and support content (`/docs/members`, `/docs/experts`, `/docs/clinics`)
- product guides
- the future API reference under `/docs/api-reference`

Fumadocs UI is not used: it depends on Radix, which is banned outside
`packages/editor` (ADR-023). Layout, sidebar, table of contents and search
dialog are built from `@eleva/ui`. The search index and `llms.txt` are
generated at build time as static files, because HTTP API route handlers
(`route.ts`) live only in `apps/api`.

## AI And Search-Readable Content

Eleva should intentionally prepare:

- structured public metadata
- strong page hierarchy
- bot-friendly text alternatives where useful
- LLMs.txt and markdown-readable content where it improves discoverability and documentation access

## Compliance Considerations

Public content must remain aligned with Eleva's approved platform framing and avoid:

- overclaiming verification
- implying Eleva is the direct clinical provider
- misleading clinical guarantees

## Public-site parity (D-10) — Phase 04

Locales: `en` unprefixed, `pt` / `es` prefixed. `pt-BR` is retired (D-01): gateway `301`s `/pt-BR/*` → `/pt/*`.

| MVP / request                                                          | Disposition on 2026-09-10                                                                                                | Evidence                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `/[username]`, `/[username]/[eventSlug]`                               | Kept                                                                                                                     | `apps/web` + `public_handles`        |
| `/become-expert`, `/for-clinics`                                       | Draft pages (ERS-safe; noindex)                                                                                          | `#46` on `main`                      |
| `/for-organizations`                                                   | Exact-path `301` → `/for-clinics`                                                                                        | `#46`                                |
| `/legal/{terms,privacy,health-data,cookies,payments,expert-agreement}` | Working `CONSENT_DOCUMENTS` drafts                                                                                       | 04.2a on `main`                      |
| `/about`                                                               | Marketing page                                                                                                           | `main`                               |
| `/quiz`, `/health-quiz`, `/questionario`, `/cuestionario`              | `301` → `/experts` (en, unprefixed); `/pt/quiz` → `/pt/experts`; `/es/quiz` → `/es/experts` (same first-segment aliases) | PR `#45` (open)                      |
| `/help`, `/support`, `/faq`                                            | `301` → `/docs`                                                                                                          | PR `#45` (open)                      |
| `/trust`, `/trust/dpa`                                                 | `301` → `/trust/security`, `/trust/ers` drafts                                                                           | PR `#45` (open)                      |
| `/contact`                                                             | Draft page, no form, no API                                                                                              | PR `#45` (open); POST stopped at DPO |
| `/community`                                                           | No v3 route (404); Instagram + LinkedIn footer only                                                                      | PR `#45` (open)                      |

Private booking links (`/book/[token]`) are `robots: noindex`. Contact POST + Resend remain gated.

### Changes on 2026-10-21

| Route                                                    | New disposition                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `/community`                                             | Landing page linking to the Beehiiv community (replaces the 404) |
| `/newsletter`, `/podcast`                                | New pillar landing pages                                         |
| `/evidence-based-care`                                   | New MDX page with references                                     |
| `/legal/*`                                               | MDX final text; adds `accessibility` and `complaints`            |
| `/legal/cookie`, `/legal/payment-policies`               | `301` → `/legal/cookies`, `/legal/payments`                      |
| `/trust/dpa`, `/trust/sub-processors`                    | Real MDX pages (the `/trust/dpa` redirect is removed)            |
| `/help/patient/*`, `/help/expert/*`, `/help/workspace/*` | `301` → `/docs/members/*`, `/docs/experts/*`, `/docs/clinics/*`  |

## Resolved Questions (2026-10-21)

- **web vs docs**: marketing, legal, trust and evidence pages render in
  `apps/web`; the help center renders in `apps/docs`. Both read from
  `@eleva/content`.
- **Blog**: none. Beehiiv (Femme Focus) is the editorial channel.
- **CMS timing**: Git-first MDX now; the loader interface keeps a CMS
  migration cheap.

## Open Questions

- exact expert profile SEO policy for indexing and localization

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
- [`domain-model.md`](./domain-model.md)
