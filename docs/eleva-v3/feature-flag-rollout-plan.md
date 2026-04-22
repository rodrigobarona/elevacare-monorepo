# Eleva.care v3 Feature Flag Rollout Plan

Status: Living

## Purpose

This document defines how Eleva v3 should use feature flags for safe rollout.

It should guide:

- progressive release strategy
- risky feature launch control
- environment-specific toggles
- cleanup discipline

## Principles

- Use feature flags for rollout safety, not as a substitute for architecture.
- Flag high-risk or launch-sensitive features, not every tiny UI branch.
- Keep ownership and cleanup explicit.
- Every feature flag should have a rollout intent and removal plan.

## When To Use A Flag

Good uses:

- new booking/payment flows
- AI report generation
- mobile sharing flows
- organization/clinic capabilities
- experimental discovery ranking

Bad uses:

- permanent product complexity with no cleanup owner
- avoiding hard decisions
- replacing role-based access with ad hoc booleans

## Recommended Rollout Stages

1. development-only
2. internal staff only
3. selected experts or orgs
4. wider staged rollout
5. default on
6. cleanup and removal

## Flag Metadata To Track

For each flag, track:

- name
- purpose
- owner
- scope
- rollout stage
- kill-switch expectations
- cleanup target

## High-Value Early Flags

Examples:

- AI draft reporting
- diary sharing to experts
- organization-admin capabilities
- advanced packs/subscription options

## Related Docs

- [`roadmap-and-milestones.md`](./roadmap-and-milestones.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
