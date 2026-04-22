# ADR-001: Start With One Authenticated Product App

## Status
Accepted

## Date
2026-04-22

## Context

Eleva.care v3 needs to support multiple authenticated personas and workflows:

- experts
- patients
- organization admins
- Eleva internal operators

At the same time, the platform is still defining its long-term product boundaries.
Future directions may include:

- clinician and non-clinical expert types
- organization/team expansion
- Eleva Academy
- mobile-first companion experiences

The team considered whether to begin with:

- separate authenticated apps from day one
- one authenticated app with RBAC and route-group separation

## Decision

Eleva.care v3 will start with:

- one public `apps/web`
- one authenticated `apps/app`
- one `apps/api`
- supporting docs and email apps

The authenticated product will use:

- route-group separation
- capability-based RBAC
- shared package boundaries

The architecture must remain ready for a later split into multiple authenticated apps if justified by product or organizational needs.

## Alternatives Considered

### Separate expert, patient, and admin apps from day one

Pros:

- stronger app isolation
- potentially clearer per-surface ownership
- may align with future independent teams

Cons:

- adds auth and routing complexity early
- duplicates shells and navigation concerns
- increases deployment and environment coordination
- introduces more cross-app flow complexity while the product is still shared
- risks splitting on today's roles rather than tomorrow's true product boundaries

Rejected because:

The Eleva domain still has too many deeply shared objects and flows for this split to pay off early.

### Single full-stack app for everything, including public website

Pros:

- simplest initial deployment model
- lowest app-count overhead

Cons:

- public marketing and authenticated product concerns become tightly mixed
- SEO and marketplace needs are harder to isolate
- public and authenticated release pressure become coupled

Rejected because:

The public discovery/marketing surface and the authenticated product surface already have meaningfully different concerns and should be separate apps.

## Consequences

- The team can move faster in the first implementation phases.
- Shared product objects remain easier to model consistently.
- RBAC and route-group architecture become critical and must be designed carefully.
- Future app splitting remains possible, but should happen only with explicit justification.
- Academy should begin as a domain/package boundary, not as a separate app from day one.
