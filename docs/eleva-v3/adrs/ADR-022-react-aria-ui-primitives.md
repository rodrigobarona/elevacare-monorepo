# ADR-022: React Aria Components as the `@eleva/ui` primitive layer

## Status

Accepted

## Date

2026-09-07

## Context

`@eleva/ui` was scaffolded from the shadcn/ui monorepo template on top of Radix UI primitives (`radix-ui` unified package, `cmdk` for the command palette, `react-hook-form` + `@hookform/resolvers` for the `Form` helper). Every app in the monorepo (`apps/web`, `apps/account`, `apps/expert`, `apps/poc`, and `@eleva/dashboard`) consumed those primitives.

Before the v3 execution plan starts (Better Auth foundation, marketplace booking, member app — see [`execution-plan/README.md`](../execution-plan/README.md)), we want the primitive layer settled so that the large amount of new UI written in Phases 2–5 does not need a second migration.

Reasons to move off Radix now:

- **Accessibility depth.** Adobe's React Aria implements the full ARIA Authoring Practices for every pattern (focus management, typeahead, virtual focus, screen-reader announcements, RTL, mobile press handling) and is maintained by the team that co-authors the specs. Eleva is a healthcare platform in Portugal with public-sector customers; WCAG 2.1 AA is a hard requirement, not a nice-to-have.
- **Forms and collections.** React Aria ships first-class `Form`, `Select`, `ComboBox`, `ListBox`, `GridList`, `Table`, `Calendar`, `DatePicker`, `TimeField` and `NumberField` primitives with native form participation (hidden inputs, `name`, `validationBehavior`). The booking flow (Phase 4) and scheduling editor need calendar/date/time pickers that Radix does not provide.
- **Composition model.** Radix's `asChild`/Slot pattern leaks into every consumer and breaks with React 19 ref-as-prop semantics in subtle ways. React Aria uses render props and `href`-on-any-pressable (`Button`, `Link`, `MenuItem`, `ListBoxItem`) plus a single `RouterProvider`, which maps cleanly onto our multi-zone routing model ([ADR-014](ADR-014-multi-zone-rewrites.md)).
- **shadcn already supports it.** shadcn v4 ships an official `aria-luma` style whose components are built on `react-aria-components`. Regenerating through the CLI keeps `components.json` as the SSOT and keeps future `shadcn add` upgrades cheap.

Alternatives considered:

- **Stay on Radix.** Lowest immediate effort; but Phase 4/5 would need third-party date pickers and combobox libraries anyway, and the `asChild` model does not compose well with React 19.
- **Headless UI / Ark UI / Base UI.** Smaller pattern coverage than React Aria, no shadcn style, and no equivalent of `RouterProvider`.
- **Hand-write on `react-aria` hooks (no `react-aria-components`).** Maximum control, but we would lose the shadcn registry and have to own every styled primitive.

## Decision

1. `@eleva/ui` uses **`react-aria-components`** as its only primitive library. `radix-ui`, `cmdk`, `react-hook-form`, and `@hookform/resolvers` are removed from the package. `shadcn` stays in `dependencies` — besides the CLI it ships `shadcn/tailwind.css`, the Tailwind v4 `@custom-variant` set (`data-open`, `data-focused`, `data-selected`, …) that `globals.css` imports and every `aria-luma` primitive styles against.
2. `packages/ui/components.json` sets `"style": "aria-luma"`. Primitives are regenerated with `pnpm exec shadcn add --overwrite <component>` from `packages/ui`; after regeneration, imports are rewritten (`cn` → `@eleva/ui/lib/utils`, icons → `@eleva/icons`) and the `// eleva:` patches (decision 7) are re-applied.
3. Components with no `aria-luma` equivalent are deleted rather than ported: `navigation-menu`, `form` (RHF-based). `field` replaces `form` for labelled inputs.
4. **Routing:** `@eleva/ui/components/router-provider` exports `AppRouterProvider`, which wires React Aria's `RouterProvider` to the Next.js App Router. Relative `href`s use `router.push`; absolute URLs (`https://…`) force `window.location.assign` so cross-zone links still hit the gateway rewrites. `@eleva/dashboard`'s `DashboardProviders` mounts it. `apps/web` (marketing) deliberately does **not** mount it — its links must be native anchors so the gateway can rewrite into other zones, and it uses the `next-intl` locale-aware `Link` for internal navigation.
5. **Consumer API conventions** (enforced by TypeScript, documented in `.cursor/rules/react-aria-ui.mdc`):
   - `isDisabled`, `isOpen`, `isSelected`, `selectedKey`, `onPress`, `onOpenChange`, `onSelectionChange`, `onAction` — never `disabled`, `open`, `checked`, `onClick`, `onValueChange`, `onSelect`.
   - No `asChild`. Use `LinkButton` / `href` for navigation, `buttonVariants()` class composition in Server Components, and render props for custom children.
   - Overlays are single components: `Dialog`, `Sheet`, `AlertDialog`, `Popover`, `DropdownMenu` take `isOpen`/`onOpenChange` directly; there is no `*Content` wrapper except `AlertDialogContent`/`SheetContent`/`SelectContent` aliases kept by the registry.
   - `DropdownMenuTrigger` wraps both the trigger button and the `DropdownMenu`. `MenuItem`s carry `id` and `textValue`.
   - `Checkbox` renders its own `<label>`; use `CheckboxField` (label + `Field` layout) instead of wrapping in another `<label>`.
6. `@radix-ui/themes` remains as a **transitional WorkOS Widgets peer dependency only** (the widgets render inside Radix Themes). It is not a UI primitive source and must not be imported outside the WorkOS widget wrappers. Phase 3 of the execution plan ([`03-remove-workos.md`](../execution-plan/phases/03-remove-workos.md)) deletes those wrappers and removes `@radix-ui/themes` from `pnpm-workspace.yaml` catalog, every `package.json`, and the `import "@radix-ui/themes/styles.css"` lines in org-scoped layouts in the same PR — after Phase 3 the repo has zero Radix dependencies.
7. **Local patches to generated primitives** are allowed only for registry bugs or Eleva a11y/product decisions, must be marked with an `// eleva:` comment, and are re-applied after every `shadcn add --overwrite` (the CLI discards them). The list of current patches is maintained in `.cursor/rules/react-aria-ui.mdc`.

## Consequences

Positive:

- Full ARIA pattern coverage and consistent keyboard/screen-reader behaviour across all apps with no app-level work.
- Native form participation removes hidden-input plumbing (`Select name="…"` submits directly to Server Actions).
- Date/time/calendar/combobox primitives are available for Phase 4 booking without new vendors.
- One routing integration point instead of per-component `Link` wrapping.

Negative / costs:

- Every consumer touched by the migration changed props (`disabled` → `isDisabled`, etc.). Future contributors must learn the React Aria prop vocabulary; the rule file and TypeScript errors are the guardrails.
- `react-aria-components` is a larger dependency than Radix (~+60 kB gz for the full set). Mitigated by shadcn's per-component imports and Next.js `optimizePackageImports`.
- Some visual behaviours differ (React Aria `Popover` positioning, `data-focused` vs `data-highlighted`). Tailwind selectors were updated in the regenerated primitives; app-level overrides that targeted `data-[state=…]` were removed.
- `apps/poc` had no `typecheck` script and was migrated by running `tsc` directly; it should gain the script in Phase 1 CI rebaseline.

## Related

- [`design-system-spec.md`](../design-system-spec.md)
- [`ADR-014-multi-zone-rewrites.md`](ADR-014-multi-zone-rewrites.md)
- [`.cursor/rules/react-aria-ui.mdc`](../../../.cursor/rules/react-aria-ui.mdc)
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html)
- [shadcn/ui React Aria base (July 2026 changelog; Luma style)](https://ui.shadcn.com/docs/changelog/2026-07-react-aria) and per-component docs under [`/docs/components/aria/*`](https://ui.shadcn.com/docs/components/aria/button)
