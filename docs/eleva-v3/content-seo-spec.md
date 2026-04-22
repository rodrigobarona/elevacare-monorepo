# Eleva.care v3 Content And SEO Spec

Status: Living

## Purpose

This document defines the content and SEO direction for Eleva.care v3.

It should guide:

- marketing information architecture
- expert marketplace discoverability
- docs/blog strategy
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

- blog
- evidence and methodology pages
- future thought-leadership content

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

Fumadocs is the preferred docs/content direction for:

- help and support content
- product guides
- future docs-oriented information architecture

The docs system should remain compatible with markdown-first authoring and versioned changes in Git.

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

## Open Questions

- what content should live in `apps/web` versus `apps/docs`
- what editorial/blog strategy belongs in the first build
- whether a headless CMS layer is required early or if Git-first content is enough
- exact expert profile SEO policy for indexing and localization

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
- [`domain-model.md`](./domain-model.md)
