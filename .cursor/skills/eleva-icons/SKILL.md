# Eleva Icons (Phosphor SSOT)

Use when adding UI icons, sidebar nav icons, marketing illustrations, or migrating away from Lucide.

## Import boundary

```tsx
// Server layouts & UI primitives
import { CalendarIcon } from "@eleva/icons"

// Client components only
import { ElevaIcon, NavIcon } from "@eleva/icons/client"
```

Never import `@phosphor-icons/react` or `lucide-react` outside `packages/icons`. The main entry uses Phosphor **SSR** icons (safe in Server Components).

## Sidebar nav (duotone when active)

Server layouts pass a **serializable** `NavIconName` string (not a component):

```tsx
// Server layout — no @eleva/icons component imports for nav
{ title: t("dashboard"), url: base, icon: "SquaresFourIcon" }
```

`NavMenuItemLink` (client) calls `getNavIcon(name)` then renders `NavIcon` — light when idle, **duotone** when active.

Add new nav icons to `packages/icons/src/nav-icon-registry.ts` (`NavIconName` + `navIconRegistry`).

## Weights

| Context                   | Weight    | Size  |
| ------------------------- | --------- | ----- |
| Sidebar idle              | `light`   | 20    |
| Sidebar active            | `duotone` | 20    |
| Chrome (chevrons, checks) | `regular` | 16    |
| Marketing / empty states  | `duotone` | 32–96 |

Avoid `bold` in product UI.

## Duotone illustrations

```tsx
<ElevaIcon
  icon={CalendarIcon}
  weight="duotone"
  size={48}
  className="text-eleva-primary"
  duotoneColor="rgb(var(--eleva-primary-light))"
/>
```

## Adding an icon

1. Add Phosphor export to [`packages/icons/src/icons.tsx`](../../packages/icons/src/icons.tsx).
2. Add a Lucide alias only when migrating legacy names.
3. Use from `@eleva/icons` in apps.

## shadcn UI

- `packages/ui/components.json` → `"iconLibrary": "phosphor"`
- Run `pnpm dlx shadcn@latest add <component>` from `packages/ui` when updating primitives.

## Sidebar motion (implemented)

`NavMenuItemLink` + `NavIcon` in `@eleva/dashboard`:

- Idle: `light` weight
- Hover/focus: `regular` + subtle `scale-105`
- Active: `duotone` + left accent bar + `scale-[1.02]`
- `prefers-reduced-motion`: active uses `fill` (not duotone), no scale transitions

Pass `hovered` from the link’s pointer/focus handlers; do not rely on icon-only hover state.

See [`packages/icons/README.md`](../../packages/icons/README.md) and [brand book § Iconography](../../docs/eleva-v3/brand-book/README.md).
