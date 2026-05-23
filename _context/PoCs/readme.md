# Eleva product PoCs

Interactive walkthrough specs and runnable mocks for client review.

## Runnable app

**`apps/poc`** — `@eleva/poc` on port **3099**

```bash
pnpm --filter @eleva/poc dev
```

Open [http://localhost:3099](http://localhost:3099) for the global hub.

## Domains

| Domain | App route | Status | Spec |
|--------|-----------|--------|------|
| [Expert onboarding](expert-onboarding/readme.md) | `/expert-onboarding` | Live (5 walkthroughs) | [hub](expert-onboarding/readme.md) |
| [Expert public profile](expert-profile/readme.md) | `/expert-profile` | Planned | [stub](expert-profile/readme.md) |
| [Booking flow](booking-flow/readme.md) | `/booking-flow` | Planned | [stub](booking-flow/readme.md) |

## Conventions

- **`_shared/`** — cross-domain PoC patterns (wizard framework, future shared UX notes)
- **`<domain>/walkthroughs/`** — one folder per walkthrough variant with step tables
- **`<domain>/shared/`** — domain-specific data models, assets, production notes
- **App mirror:** `apps/poc/src/domains/<domain>/` holds runnable code; `apps/poc/src/lib/poc-catalog.ts` registers domains for the hub UI

When adding a new PoC domain:

1. Create `_context/PoCs/<domain>/readme.md` + walkthrough folders
2. Add `apps/poc/src/domains/<domain>/` and register in `poc-catalog.ts`
3. Add `apps/poc/src/app/<domain>/` routes
