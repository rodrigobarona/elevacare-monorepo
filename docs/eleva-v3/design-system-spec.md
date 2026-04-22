# Eleva.care v3 Design System Spec

Status: Living

## Purpose

This document defines the design system direction for Eleva.care v3.

It should guide:

- `packages/ui`
- app consistency across web, docs, email, and future mobile-adjacent styling decisions
- component governance
- design token decisions

## Design System Principles

- The product should feel trustworthy, calm, modern, and efficient.
- Shared primitives should live in `packages/ui`.
- Product surfaces can differ in tone, but not in core interaction quality.
- Accessibility is part of the system, not a separate pass.
- Reuse tokens and primitives before inventing app-specific UI.

## Core Goals

The design system should support:

- public marketing surfaces
- authenticated product surfaces
- admin/operator tooling
- email design consistency
- future Academy and mobile-adjacent brand consistency

## Package Ownership

### `packages/ui`

Should own:

- base primitives
- semantic components
- layout helpers
- form building blocks
- feedback states
- shared icons/tokens where appropriate

### App ownership

Apps should own:

- page composition
- feature-specific UX
- route-level layout logic

Apps should not duplicate primitive components unless there is a justified local exception.

## Token Strategy

The system should define tokens for:

- color
- typography
- spacing
- radius
- shadows
- borders
- motion
- z-index/layering

Prefer semantic tokens over hardcoded visual values in app code.

## Themes

The design system should support:

- light mode
- dark mode

Dark mode should not be an afterthought.
It must be verified for:

- contrast
- charts/visual emphasis later
- overlays and modals
- form affordances

## Component Categories

The first set of components should cover:

### Foundations

- buttons
- inputs
- textareas
- selects
- checkboxes/radios/switches
- badges
- avatars
- cards
- dialogs
- popovers

### Form system

- field wrappers
- validation messages
- grouped sections
- submit states

### Navigation

- sidebar
- tabs
- breadcrumbs
- command/search patterns later

### Feedback

- toasts
- alerts
- empty states
- loading states
- error states

### Data display

- tables
- lists
- timeline blocks
- stat cards

## Role And Surface Variants

The same system should support:

- public marketing polish
- expert productivity surfaces
- patient clarity and reassurance
- admin density where needed

This should come from composition and variants, not separate mini design systems.

## Accessibility Rules

Every reusable component should be designed for:

- keyboard access
- clear focus states
- adequate contrast
- screen-reader-friendly labeling

## Documentation Expectations

The design system should eventually document:

- component purpose
- allowed variants
- do/don't usage
- accessibility notes
- app examples

Storybook is a likely later home for this, but the design system can start before Storybook exists.

## Email Relationship

Email templates should not share implementation directly with app UI components unless the abstraction is truly safe.

But they should share:

- token decisions
- brand language
- visual rhythm where practical

## Open Questions

- exact token naming strategy
- when Storybook should be introduced
- how much of the brand-book visual language becomes component-level system guidance

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`content-seo-spec.md`](./content-seo-spec.md)
- [`brand-book/README.md`](./brand-book/README.md)
