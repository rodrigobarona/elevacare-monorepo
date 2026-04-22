# 12 — Internationalization

> next-intl handles four locales (`en`, `pt`, `pt-BR` → `br`, `es`) with custom country-based detection and `ELEVA_LOCALE` cookie persistence. Email templates are localized separately. The model mostly works — this chapter documents it cleanly and locks in a few opinionated patterns for v2.

## What we built

### Locales

Four locales in [messages/](../../messages/):

- `en.json` — English (default)
- `pt.json` — Portuguese (Portugal, pt-PT)
- `br.json` — Brazilian Portuguese. **The locale code in the URL and the cookie is `br`, not `pt-BR`.** This asymmetry is deliberate but a recurring source of confusion.
- `es.json` — Spanish

### Routing

- `defaultLocale = 'en'`
- `localePrefix: 'as-needed'` — English routes have no prefix; other locales use `/pt/...`, `/br/...`, `/es/...`.
- Configuration in [lib/i18n/](../../lib/i18n/) (`index.ts`, `routing.ts`, `request.ts`, `navigation.ts`).

### Custom locale detection

Disabled next-intl's automatic detection. Instead, [proxy.ts](../../proxy.ts) calls `detectLocaleFromHeaders(request.headers)` from [lib/i18n/utils.ts](../../lib/i18n/utils.ts):

- Read `accept-language` and Vercel's `x-vercel-ip-country` (when available).
- Portuguese visitors **from Portugal** get `pt`, not `pt-BR`.
- Spanish-speaking countries map to `es`.
- Brazilian visitors get `br`.
- Default to `en`.

### Cookie persistence

`ELEVA_LOCALE` cookie with `maxAge: 31536000` (1 year). Once a visitor selects a locale (via the language switcher) or one is detected, subsequent visits respect the cookie.

### Cookie translations

[lib/i18n/cookie-translations.ts](../../lib/i18n/cookie-translations.ts) maps non-prefixed routes to their localized variants when the cookie indicates a non-default locale.

### Email i18n

[emails/utils/i18n.ts](../../emails/utils/i18n.ts) provides per-row label translation. Pattern enforced in `AGENTS.md`:

- Always preserve locale labels (e.g., `locale === 'pt' ? 'Data' : 'Date'`).
- Conditionally render rows when fields are empty strings.

### Localized routes vs locale-free routes

- `app/[locale]/(public)/*` — all marketing & booking funnel routes are locale-prefixed.
- `app/[locale]/(auth)/*` — sign-in/sign-up are locale-prefixed.
- `app/(private)/*` — dashboard, admin are **NOT** localized. Internal team operates in English.

## Why these choices

- **`as-needed` prefix**: English is the canonical URL (better SEO defaults), other locales remain clearly demarcated.
- **Custom detection**: next-intl's automatic logic was sending Portuguese-from-Portugal visitors to `pt-BR` (a UX bug). We override with country-aware logic.
- **`br` instead of `pt-BR`**: cleaner URLs, matches the filename, avoids hyphenated locale collisions.
- **No localization for private app**: internal team is monolingual; saves 4× translation maintenance burden on dashboards/admin.
- **Email per-row labels**: the safest model — even if a translation is missing, the layout doesn't break.

## What worked

- next-intl's server-component model integrates cleanly with App Router.
- `ELEVA_LOCALE` cookie removes the "redirect on every visit" ugliness.
- Custom country detection eliminated misrouted Portuguese traffic.
- Per-row email labels survive missing translations gracefully.

## What didn't

| Issue                                       | Detail                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pt-BR` vs `br` asymmetry undocumented**  | New devs constantly wonder why `messages/br.json` exists with no `pt-BR.json`. Intent must be permanent docs.                                          |
| **Cache Components disabled**               | next-intl doesn't yet support Next.js 16's Cache Components / `use cache`. [next.config.ts](../../next.config.ts) explicitly disables it.             |
| **next-intl + `cacheComponents` blocked**   | Tracked in `next-intl` issue [#1493](https://github.com/amannn/next-intl/issues/1493). We're stuck on `revalidate` per-page until library catches up. |
| **Translation keys leak into UI**           | When a key is missing, the raw key string is rendered. No build-time guard.                                                                            |
| **No translation linting**                  | Adding a key in `en.json` and forgetting to add it to `pt/br/es` ships English fallback to non-English users.                                          |
| **Categories not translated**               | The six women's-health verticals are stored as raw strings. Should be a translations join table (per [11-admin-audit-ops.md](11-admin-audit-ops.md)). |
| **Email template duplication**              | Per-locale labels are inlined in templates instead of being looked up from a central messages file. Drift over time.                                  |

## v2 prescription

### 1. Keep next-intl, keep four locales

No reason to migrate frameworks. Adopt-as-is. Reaffirm:

- `defaultLocale = 'en'`
- `localePrefix: 'as-needed'`
- `ELEVA_LOCALE` cookie, 1-year max-age
- `pt-BR` URL-locale-code is **`br`**; document this in `apps/web/i18n/README.md` permanently

### 2. Custom country detection moves to `packages/i18n`

```text
packages/i18n/
├── locales.ts                # exports defaultLocale, locales[], type Locale
├── detect.ts                 # detectLocaleFromHeaders()
├── routing.ts                # next-intl routing config
├── messages/
│   ├── en.json
│   ├── pt.json
│   ├── br.json
│   └── es.json
├── cookie-translations.ts
└── README.md                 # documents pt-BR vs br
```

The `apps/web` and `packages/email` both import from `packages/i18n`.

### 3. Translation lint in CI

Add a script `scripts/i18n/check-keys.ts` that:

- Loads `en.json` as the source of truth.
- Asserts every key exists in `pt`, `br`, `es`.
- Asserts no extra keys exist (orphans).
- Fails CI on drift.

Optionally: a `--missing-keys` mode that emits stub entries for translators.

### 4. Categories localization

`categories` table gets a `name` jsonb column or a `category_translations` join table (`category_id`, `locale`, `name`, `description`, `slug`). Admin UI edits all four locales side-by-side.

### 5. Email i18n centralized

Move email labels from inlined ternaries into `packages/i18n/messages/email.{locale}.json`. Templates import a typed `t(key)` helper. Pattern keeps "preserve locale labels" constraint intact while removing duplication.

### 6. URL slug localization (Phase 2)

For SEO, certain pages benefit from localized slugs (e.g., `/pt/sobre`, `/br/sobre`, `/es/acerca-de`, `/about`). Use next-intl's `pathnames` config:

```ts
export const pathnames = {
  '/about': { en: '/about', pt: '/sobre', br: '/sobre', es: '/acerca-de' },
  '/become-partner': { en: '/become-partner', pt: '/sou-profissional', br: '/sou-profissional', es: '/soy-profesional' },
};
```

Adopt incrementally; only worth the maintenance overhead for high-traffic pages.

### 7. Cache Components: revisit when next-intl supports it

When next-intl adds `cacheComponents` support (tracked upstream), enable `cacheComponents: true` in `next.config.ts` and migrate static-content pages to `'use cache'` directives. Until then, keep `revalidate` per page.

### 8. Locale switcher UX

- Visible in header on every public page.
- Sets `ELEVA_LOCALE` cookie on selection.
- Re-renders without full reload (Next.js client navigation).
- Email opt-out preserves the current locale on the unsubscribe page.

### 9. Date / number / currency formatting

Always use `Intl.DateTimeFormat` and `Intl.NumberFormat` keyed on the active locale. Money displayed via `formatCurrency(amount, 'EUR', locale)` from `packages/i18n/format.ts`. No hardcoded `toFixed(2) + ' €'`.

### 10. Locale propagation to Resend

Every `sendTransactional()` call passes `locale: Locale`. Resend tags include `locale:<code>` for analytics. Newsletter audience contacts get a `locale` attribute so future broadcasts can segment.

## Concrete checklist for the new repo

- [ ] `packages/i18n` exposes locales, detection, routing, messages, format helpers.
- [ ] `apps/web/i18n/README.md` permanently documents the `pt-BR` ↔ `br` asymmetry.
- [ ] `messages/{en,pt,br,es}.json` exist and have parity (CI-enforced).
- [ ] Translation key check is part of `pnpm test` and runs in CI.
- [ ] Email templates import labels from `packages/i18n/messages/email.{locale}.json`.
- [ ] Categories carry per-locale names via `category_translations` table or `name` jsonb.
- [ ] Locale switcher in header sets cookie and re-renders without full reload.
- [ ] `formatCurrency`, `formatDate`, `formatNumber` are the only ways to format displayed values.
- [ ] Every `sendTransactional()` call carries `locale` and Resend tags include it.
- [ ] Cache Components remain disabled in `next.config.ts` with a TODO citing next-intl issue #1493.
