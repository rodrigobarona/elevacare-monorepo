# `@eleva/eslint-config`

Shared eslint configuration for the workspace.

| Config                | For                         | What it adds                                                                                                                  |
| --------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `./base`              | every package               | The recommended rules, and the bans that hold everywhere (the auth library and icons through our packages)                    |
| `./next-js`           | Next.js apps                | `./base` plus the Next.js and React rules                                                                                     |
| `./react-internal`    | React packages              | `./base` plus the React rules                                                                                                 |
| `./boundaries`        | apps                        | Vendor SDKs only through the package that owns them; health data is not unwrapped in an app                                   |
| `./frontend-db-reads` | every app except `apps/api` | From `@eleva/db`: the read helpers on its list (`FRONTEND_DB_READS`) and types, and nothing else. Use it after `./boundaries` |

## Warnings, and what fails a build

`./base` uses `eslint-plugin-only-warn`: every finding is a warning, so
`pnpm lint` exits 0 whatever it finds. The boundary rules must not be
warnings, so CI runs them alone with `pnpm check:boundaries`
(`scripts/check-boundaries.mjs`), which fails on any finding. It does not
obey `eslint-disable` comments.

## An app's lint config is the shared configs, and nothing else

```js
export default [...nextJsConfig, ...boundariesConfig, ...frontendDbReadsConfig]
```

`pnpm check:boundaries` reads the file as text, before loading it, and
fails an app whose config has anything more or less: another entry, or any
other line of code. (`apps/api` leaves out `frontendDbReadsConfig`; an app
that is not Next.js starts from the base config.) The reason: in a flat config a later setting
of a rule replaces the earlier one, it is not added to it, and an `ignores`
entry takes a folder out of lint. One extra entry in one app can switch a
boundary off without a word. A change an app needs goes here, in this
package.

A shared config that needs its own `no-restricted-imports` or
`no-restricted-syntax` entries has to carry the earlier entries with it, as
`./frontend-db-reads` does with `BOUNDARY_SYNTAX`.

## What the check is for

It stops a boundary from being crossed or switched off by mistake, or
quietly, in an ordinary change. It does not stand against someone who sets
out to defeat it: these configs and the script can be edited, and the CI
step can be removed. Review stands against that.

What it cannot see:

- a module name put together at run time, or one reached through an alias
  (`imports` in `package.json`, `paths` in `tsconfig.json`);
- a module that is banned only for some of its names (`Decrypted` from
  `@eleva/observability`, the `decrypt…` helpers from `@eleva/encryption`)
  when it is loaded with `import()`;
- a relative path that climbs out of an app without naming `packages/` or
  `apps/`;
- an `import` in an `.mdx` file, and anything in a folder at the top of an
  app that is named like a generated one (`dist`, `coverage`, `.next`).

Everything under an app counts as that app: its `e2e/` and `scripts/` too.
`vi.mock("@eleva/db")` in a test is allowed; `await import("@eleva/db")` is
not.

## Packages

A package has its own lint config. One that wraps a vendor sets
`no-restricted-imports` itself, and so has to carry every other ban:
`baseImportBansWithout(isOwned)` and `boundaryImportBansWithout(isOwned)`
return the shared bans without the package's own (`packages/auth`,
`packages/icons`, `packages/editor`). Packages do not get the boundary
config by default, and `pnpm check:boundaries` checks their findings only,
not what their configs leave out.
