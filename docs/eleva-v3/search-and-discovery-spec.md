# Eleva.care v3 Search And Discovery Spec

Status: Living

## Purpose

This document defines how users should discover experts, services, and future Eleva offerings.

It should guide:

- marketplace information architecture
- public search/filter design
- ranking and discovery strategy
- expert profile visibility rules

## Discovery Principles

- Discovery should feel trustworthy before it feels exhaustive.
- Search quality depends on a strong expert/event taxonomy.
- Filters should reflect real user decision criteria, not internal data model convenience.
- Category and profile pages should support both conversion and SEO.
- Discovery should support healthcare and future non-clinical expert types without redesigning the whole system.

## Core Discovery Goals

Users should be able to find experts by:

- category
- specialty/topic
- language
- country/countries of practice
- modality
- price range
- availability
- ratings/trust signals later

## Discovery Surfaces

### Marketplace landing

Should communicate:

- what Eleva offers
- categories
- trust and quality
- clear entry points into search

### Category pages

Should support:

- SEO
- curation
- filtering
- explanation of the category

### Search/filter results

Should support:

- responsive filtering
- sorting
- visible trust markers
- next availability cues

### Expert profile pages

Should support:

- expert story and credibility
- specialty/language/location visibility
- pricing and event types
- next action to book

## Filter Model

Recommended first filters:

- category
- specialty
- language
- session type (`online`, `in_person`, `phone`)
- country/countries served
- price
- availability

Future filters may include:

- organization/clinic
- insurance or reimbursement relevant metadata if ever needed
- ratings/review density

## Ranking Signals

Initial ranking should be explicit and simple.

Possible early signals:

- relevance to selected filter set
- profile completeness
- publish/approval readiness
- availability freshness

Do not start with opaque ranking logic that the team cannot reason about.

## Expert Listing Requirements

Each expert listing should have enough structured data to support:

- search filtering
- card rendering
- category association
- public profile pages
- future ranking signals

## Localization And Discovery

Discovery must support:

- multilingual public copy
- expert-supported languages
- localized filters and labels
- localized profile and event content where applicable

## Marketplace And Trust

Discovery should reinforce trust through:

- clear expert identity
- specialties and scope
- language support
- location/country information
- profile quality
- transparent pricing

It should avoid:

- empty or thin listings
- unclear expert scope
- misleading verification language

## Search Architecture Direction

Start with a structured filtering/search approach based on the first-party domain model.

Do not over-engineer a separate search stack until:

- result scale
- ranking needs
- performance needs

justify it.

## Relationship To CRM And Scheduling

Discovery must connect cleanly into:

- expert profile pages
- event type selection
- availability lookup
- booking flow

The search layer should not invent parallel versions of expert/event truth.

## Open Questions

- exact initial ranking strategy
- whether some categories should be curated manually at launch
- when reviews become part of ranking
- whether organizations/clinics get public discovery surfaces in MVP

## Related Docs

- [`content-seo-spec.md`](./content-seo-spec.md)
- [`domain-model.md`](./domain-model.md)
- [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)
