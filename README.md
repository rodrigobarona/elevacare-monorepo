# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Eleva v3 docs

The planning and architecture handbook for the Eleva.care v3 rebuild lives in:

- [`docs/eleva-v3/README.md`](docs/eleva-v3/README.md)

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
