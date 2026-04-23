# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Eleva v3 docs

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/rodrigobarona/elevacare-monorepo?utm_source=oss&utm_medium=github&utm_campaign=rodrigobarona%2Felevacare-monorepo&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

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
import { Button } from "@eleva/ui/components/button";
```
