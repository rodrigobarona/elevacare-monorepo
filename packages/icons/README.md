# @eleva/icons

Eleva’s icon system — [Phosphor Icons](https://phosphoricons.com) via a single import boundary.

## Rules

- Import icons from `@eleva/icons` (server-safe, Phosphor SSR).
- Import `NavIcon`, `ElevaIcon`, hooks from `@eleva/icons/client` (client components only).
- Do not import `@phosphor-icons/react` or `lucide-react` outside this package.

## Weights

| Context         | Weight              | Size   |
| --------------- | ------------------- | ------ |
| Sidebar default | `light`             | 20px   |
| Sidebar active  | `fill` or `duotone` | 20px   |
| UI chrome       | `regular`           | 16px   |
| Illustrations   | `duotone`           | ≥ 32px |

## Sidebar nav (RSC-safe)

Server layouts pass `NavIconName` strings (`"UserIcon"`, `"SquaresFourIcon"`, …). Registry: `src/nav-icon-registry.ts`. Client code resolves with `getNavIcon` from `@eleva/icons/client`.

```tsx
// Server layout
{ title: t("settings"), url: "/account/settings", icon: "UserIcon" }
```

## Sidebar nav motion

`NavIcon` + `NavMenuItemLink` (`@eleva/dashboard`):

| State                   | Weight    | Motion                      |
| ----------------------- | --------- | --------------------------- |
| Idle                    | `light`   | —                           |
| Hover / focus           | `regular` | `scale-105` (200ms)         |
| Active                  | `duotone` | accent bar + `scale-[1.02]` |
| Reduced motion + active | `fill`    | no scale                    |

## Duotone (brand colors)

```tsx
import { CalendarIcon } from "@eleva/icons"
import { ElevaIcon } from "@eleva/icons/client"
;<ElevaIcon
  icon={CalendarIcon}
  weight="duotone"
  size={48}
  className="text-eleva-primary"
  duotoneColor="rgb(var(--eleva-primary-light))"
/>
```

`duotoneColor` is applied via CSS to Phosphor’s `opacity="0.2"` secondary path — never passed as a DOM attribute.

## Adding an icon

1. Add the Phosphor export to `src/icons.tsx`.
2. Add a Lucide alias only if migrating legacy names.
3. Consume from `@eleva/icons`.
