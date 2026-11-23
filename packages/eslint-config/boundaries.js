import { importBansWithout } from "./base.js"

/**
 * @file Eleva boundary rules.
 *
 * Seeded in Sprint 0 with:
 * - max-lines cap on src/proxy.ts (≤50 LOC per implementation-sprints.md)
 * - stub no-restricted-imports entries for vendor SDKs (paths[] grows
 *   per-sprint as owning packages come online)
 *
 * The plan, by sprint. What is enforced is what the rules below say; a
 * line here with no rule below is a ban not written yet:
 * - leftover IDP SDKs (`@workos-inc/*`) nowhere
 * - `better-auth` only inside `@eleva/auth`
 * - S1: `@vercel/flags` / `flags` outside `@eleva/flags`
 * - S1: `@neondatabase/serverless` outside `@eleva/db`
 * - S2: `stripe`, `@stripe/stripe-js`, `@stripe/connect-js`,
 *        `@stripe/react-connect-js`, `@aws-sdk/*` outside
 *        `@eleva/billing`
 * - S2: `toconline-sdk`, `moloni` outside `@eleva/accounting`
 * - S3: `googleapis` / `@microsoft/microsoft-graph-client` outside `@eleva/calendar`
 * - S3: `@upstash/redis` outside `@eleva/scheduling` / `@eleva/workflows`
 * - S4: `resend`, `react-email` outside `@eleva/notifications` / `apps/email`
 * - S4: `twilio` outside `@eleva/notifications`
 * - S4: `workflow` (Vercel Workflows DevKit) outside `@eleva/workflows`
 * - S5: `@daily-co/daily-js` outside session UI (app zone)
 * - S5: `ai` / `@ai-sdk/*` (Vercel AI SDK) outside `@eleva/ai`
 * - Phase 4B: `platejs`, `@platejs/*`, `slate*`, `@radix-ui/*` outside
 *   `@eleva/editor` (ADR-023). The owning package takes these bans
 *   without its own (`boundaryImportBansWithout`).
 * - Phase 10: `Decrypted#reveal()` outside `@eleva/records` /
 *   `@eleva/encryption` (apps receive plaintext only as DTO fields), and apps
 *   cannot import `Decrypted`/`isDecrypted` or the `decrypt*` helpers, so a
 *   `Decrypted` value can never reach `NextResponse.json` / `secureJson`.
 *
 * - Phase 13.10: apps other than `apps/api` read from `@eleva/db` by named
 *   read helper only (`./frontend-db-reads.js`).
 *
 * Each addition above must also land in docs/eleva-v3/implementation-sprints.md
 * under "Global Rules Applied Every Sprint".
 *
 * `eslint-plugin-only-warn` (base config) turns every finding into a warning,
 * so `pnpm lint` never fails on these. What fails is `pnpm check:boundaries`
 * (`scripts/check-boundaries.mjs`, in CI), which runs these rules alone.
 *
 * Boundaries are enforced via no-restricted-imports per consumer
 * (apps/* eslint.config.js), since ESLint's flat-config currently
 * does not support package-aware allowlists. The approach: app
 * configs ban the SDK imports globally; the owning packages (which
 * have their OWN local eslint configs without boundariesConfig) are
 * the only places those imports compile.
 */

/**
 * `Decrypted#reveal()` outside the packages that own health data. Named, so
 * a config that adds its own `no-restricted-syntax` entries can keep these:
 * a later setting of a rule replaces an earlier one, it is not added to it.
 */
/**
 * A workspace named by its place on disk instead of by its package name:
 * a path that climbs out to `packages/` or `apps/`, or one into
 * `node_modules/`. A folder of an app's own named `packages` or `apps` is
 * not that (`./packages/list`, `@/components/apps/card`).
 */
const BY_PATH = "\\.\\./\\.\\./(packages|apps)/|(^|/)node_modules/"
const BY_PATH_MESSAGE =
  "Import workspace code by its package name (@eleva/...), not by a path that climbs out to packages/ or apps/, or into node_modules/: a path gets around every rule about what may import what (boundary lint)."

const REVEAL_MESSAGE =
  "Decrypted PHI is unwrapped only inside @eleva/records / @eleva/encryption when mapping into a response DTO (Phase 10 PHI lint)."

const reveal = (selector) => ({ selector, message: REVEAL_MESSAGE })

export const REVEAL_RESTRICTIONS = [
  // value.reveal()
  reveal(
    "CallExpression[callee.type='MemberExpression'][callee.property.name='reveal'][arguments.length=0]"
  ),
  // value["reveal"]() and value[`reveal`]()
  reveal(
    "CallExpression[callee.type='MemberExpression'][callee.property.value='reveal'][arguments.length=0]"
  ),
  reveal(
    "CallExpression[callee.type='MemberExpression'] > MemberExpression.callee > TemplateLiteral.property > TemplateElement[value.raw='reveal']"
  ),
  // value.reveal.call(value)
  reveal(
    "CallExpression[callee.property.name=/^(call|apply|bind)$/][callee.object.property.name='reveal']"
  ),
]

/**
 * What `no-restricted-imports` refuses in an app: each vendor SDK outside
 * the package that owns it, and any workspace named by its place on disk.
 */
const BOUNDARY_IMPORT_BANS = {
  paths: [
    {
      name: "stripe",
      message: "Import Stripe through @eleva/billing/server (boundary lint).",
    },
    {
      name: "@stripe/connect-js",
      message:
        "Use @eleva/billing/embedded.ElevaConnectProvider (boundary lint).",
    },
    {
      name: "@stripe/react-connect-js",
      message: "Use re-exports from @eleva/billing/embedded (boundary lint).",
    },
    {
      name: "@stripe/stripe-js",
      message:
        "Stripe.js access goes through @eleva/billing/embedded (boundary lint).",
    },
    {
      name: "@aws-sdk/client-s3",
      message: "Use @eleva/storage helpers (boundary lint).",
    },
    {
      name: "@aws-sdk/s3-request-presigner",
      message:
        "Use @eleva/storage/upload-client (browser) or @eleva/storage/upload-handler (route handler) (boundary lint).",
    },
    {
      name: "twilio",
      message:
        "Import Twilio only through @eleva/notifications (boundary lint).",
    },
    {
      name: "resend",
      message:
        "Import Resend only through @eleva/notifications (boundary lint).",
    },
    {
      name: "platejs",
      message:
        "Import Plate only through @eleva/editor (ADR-023 boundary lint).",
    },
    {
      name: "ai",
      message:
        "Import the Vercel AI SDK only through @eleva/ai (boundary lint).",
    },
    {
      name: "@daily-co/daily-js",
      message:
        "Import Daily only through @eleva/video (ADR-018 boundary lint).",
    },
    {
      name: "@eleva/observability",
      importNames: ["Decrypted", "isDecrypted"],
      message:
        'Apps never hold Decrypted<T> PHI: it serializes to "[redacted]". Return the plain DTO from @eleva/records (e.g. SessionRecordView) through secureJson (Phase 10 PHI lint).',
    },
    {
      name: "@eleva/encryption",
      importNames: [
        "decryptForOrg",
        "decryptRecordFields",
        "decryptOAuthToken",
      ],
      message:
        "Decrypt only inside domain packages (@eleva/records, @eleva/crm, @eleva/auth). Apps call their DTO-returning functions (Phase 10 PHI lint).",
    },
    {
      name: "@daily-co/daily-react",
      message:
        "Import Daily React only through @eleva/video/client (ADR-018 boundary lint).",
    },
  ],
  patterns: [
    {
      regex: BY_PATH,
      message: BY_PATH_MESSAGE,
    },
    {
      // The SDKs banned by name above, by any path inside them.
      group: [
        "stripe/**",
        "@stripe/**",
        "@aws-sdk/**",
        "twilio/**",
        "resend/**",
      ],
      message:
        "Vendor SDKs are imported only by the package that owns them: @eleva/billing, @eleva/storage, @eleva/notifications (boundary lint).",
    },
    {
      group: ["better-auth", "better-auth/*", "@better-auth/*"],
      message: "Import Better Auth only through @eleva/auth (boundary lint).",
    },
    {
      group: ["@workos-inc", "@workos-inc/**"],
      message: "Leftover identity-provider SDKs are removed. Use @eleva/auth.",
    },
    {
      group: [
        "lucide-react",
        "lucide-react/**",
        "@phosphor-icons/react",
        "@phosphor-icons/react/**",
      ],
      message:
        "Import icons from @eleva/icons (or @eleva/icons/client); only packages/icons wraps the vendor set.",
    },
    {
      group: ["@daily-co", "@daily-co/**"],
      message:
        "Import Daily only through @eleva/video (ADR-018 boundary lint).",
    },
    {
      group: ["platejs/*", "platejs/**"],
      message:
        "Import Plate only through @eleva/editor (ADR-023 boundary lint).",
    },
    {
      group: ["@platejs", "@platejs/**"],
      message:
        "Import @platejs/* only through @eleva/editor (ADR-023 boundary lint).",
    },
    {
      group: ["slate", "slate-*", "@udecode/slate", "@udecode/slate-*"],
      message:
        "Import slate* only through @eleva/editor (ADR-023 boundary lint).",
    },
    {
      group: ["@radix-ui", "@radix-ui/**"],
      message:
        "Radix is banned outside packages/editor (ADR-022 / ADR-023 exception).",
    },
    {
      group: ["@ai-sdk", "@ai-sdk/**", "ai/*", "ai/**"],
      message:
        "Import AI SDK providers only through @eleva/ai (boundary lint).",
    },
    // Sprint 2: per-adapter SDKs land in @eleva/accounting.
    // No standalone npm packages today (TOConline + Moloni use
    // raw fetch); patterns ready when a community SDK appears.
  ],
}

/**
 * The same module named as text where it can be loaded from, which the
 * import rule does not read: `import("x")`, `` import(`x`) ``,
 * `require("x")`, `module.require("x")`, `require.resolve("x")`,
 * `import.meta.resolve("x")`, `createRequire(...)("x")`, with or without a
 * type cast around the text. Other calls are left alone: `vi.mock("x")` in
 * a test is not a load, nor is `path.resolve("x")`.
 *
 * @param {string} text A regular expression, as text, for the module name.
 * @param {string} message
 */
export function namedAsText(text, message) {
  const loaders = [
    "CallExpression[callee.name='require']",
    "CallExpression[callee.property.name='require']",
    "CallExpression[callee.property.name='resolve'][callee.object.name='require']",
    "CallExpression[callee.property.name='resolve'][callee.object.type='MetaProperty']",
    // createRequire(import.meta.url)("x")
    "CallExpression[callee.type='CallExpression'][callee.callee.name='createRequire']",
    "CallExpression[callee.type='CallExpression'][callee.callee.property.name='createRequire']",
  ]
  const cast =
    ":matches(TSAsExpression, TSNonNullExpression, TSSatisfiesExpression, TSTypeAssertion)"
  return [
    `ImportExpression Literal[value=${text}]`,
    `ImportExpression TemplateElement[value.raw=${text}]`,
    ...loaders.flatMap((loader) => [
      `${loader} > Literal[value=${text}]`,
      `${loader} > ${cast} Literal[value=${text}]`,
      `${loader} > TemplateLiteral > TemplateElement[value.raw=${text}]`,
    ]),
  ].map((selector) => ({ selector, message }))
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/**
 * The modules the import bans name, as one regular expression, so that
 * the run-time bans are the import bans and not a second list. A module
 * is refused by its name and by anything under it (`stripe`,
 * `stripe/lib/x`), and not by a name that only begins the same way
 * (`stripe-event-types`). A ban written with a star (`slate-*`) is a ban
 * on every name that begins so.
 */
export function modulesAsText(modules) {
  const whole = []
  const beginnings = []
  for (const module of new Set(modules)) {
    if (/\/\*+$/.test(module)) whole.push(module.replace(/\/\*+$/, ""))
    else if (module.endsWith("*")) beginnings.push(module.slice(0, -1))
    else whole.push(module)
  }
  const parts = []
  if (whole.length > 0) {
    parts.push(`^(${[...new Set(whole)].map(escaped).join("|")})(\\/|$)`)
  }
  if (beginnings.length > 0) {
    parts.push(`^(${beginnings.map(escaped).join("|")})`)
  }
  return `/${parts.join("|")}/`
}

const VENDOR_TEXT = modulesAsText([
  ...BOUNDARY_IMPORT_BANS.paths
    // A ban on single names of a module does not ban the module, so those
    // modules can still be loaded at run time (a limit, see the README).
    .filter((path) => !path.importNames)
    .map((path) => path.name),
  ...BOUNDARY_IMPORT_BANS.patterns.flatMap((pattern) => pattern.group ?? []),
])

/** What `boundariesConfig` sets for `no-restricted-syntax`. */
export const BOUNDARY_SYNTAX = [
  ...REVEAL_RESTRICTIONS,
  ...namedAsText(
    VENDOR_TEXT,
    "Vendor SDKs are imported only by the package that owns them, also when loaded at run time (boundary lint)."
  ),
  ...namedAsText(`/${BY_PATH.replaceAll("/", "\\/")}/`, BY_PATH_MESSAGE),
]

/** @type {import("eslint").Linter.Config[]} */
export const boundariesConfig = [
  {
    files: ["**/src/proxy.ts"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    rules: {
      "no-restricted-imports": ["error", BOUNDARY_IMPORT_BANS],
    },
  },
  {
    rules: {
      "no-restricted-syntax": ["error", ...BOUNDARY_SYNTAX],
    },
  },
]

/**
 * The boundary import bans without the ones a package owns: for a package
 * that wraps a vendor and sets `no-restricted-imports` itself
 * (`packages/editor`). See `baseImportBansWithout`.
 *
 * @param {(module: string) => boolean} isOwned
 */
export function boundaryImportBansWithout(isOwned) {
  return ["error", importBansWithout(BOUNDARY_IMPORT_BANS, isOwned)]
}
