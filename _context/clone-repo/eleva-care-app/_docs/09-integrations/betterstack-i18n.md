# BetterStack Status - Multilingual Support

## Overview

The ServerStatus component is fully internationalized using next-intl, supporting multiple languages across all user-facing status messages.

## Supported Languages

- 🇬🇧 **English** (`en`) - Default language
- 🇪🇸 **Spanish** (`es`) - Español
- 🇵🇹 **Portuguese** (`pt`) - Português (Portugal)
- 🇧🇷 **Brazilian Portuguese** (`br`) - Português (Brasil)

## Status Messages

### All Systems Normal

- 🇬🇧 EN: "All systems normal"
- 🇪🇸 ES: "Todos los sistemas normales"
- 🇵🇹 PT: "Todos os sistemas normais"
- 🇧🇷 BR: "Todos os sistemas normais"

### Partial Outage

- 🇬🇧 EN: "Partial outage"
- 🇪🇸 ES: "Interrupción parcial"
- 🇵🇹 PT: "Interrupção parcial"
- 🇧🇷 BR: "Interrupção parcial"

### Degraded Performance

- 🇬🇧 EN: "Degraded performance"
- 🇪🇸 ES: "Rendimiento degradado"
- 🇵🇹 PT: "Desempenho degradado"
- 🇧🇷 BR: "Desempenho degradado"

### Unable to Fetch Status

- 🇬🇧 EN: "Unable to fetch status"
- 🇪🇸 ES: "No se puede obtener el estado"
- 🇵🇹 PT: "Não foi possível obter o estado"
- 🇧🇷 BR: "Não foi possível obter o status"

## Implementation

### Translation Files

Translations are stored in `/messages/*.json`:

```
messages/
├── en.json  # English
├── es.json  # Spanish
├── pt.json  # Portuguese (Portugal)
└── br.json  # Brazilian Portuguese
```

### Translation Structure

Each language file contains a `status` namespace:

```json
{
  "status": {
    "allSystemsNormal": "All systems normal",
    "partialOutage": "Partial outage",
    "degradedPerformance": "Degraded performance",
    "unableToFetch": "Unable to fetch status",
    "ariaLabel": "System Status: {status}"
  }
}
```

### Component Implementation

The ServerStatus component uses `getTranslations` from next-intl:

```tsx
import { getTranslations } from 'next-intl/server';

export async function ServerStatus() {
  // Get translations for current locale
  const t = await getTranslations('status');

  // Use translations for status labels
  let statusLabel = t('unableToFetch');

  // ... fetch and calculate status

  if (status === 0) {
    statusLabel = t('degradedPerformance');
  } else if (status < 1) {
    statusLabel = t('partialOutage');
  } else {
    statusLabel = t('allSystemsNormal');
  }

  return (
    <a aria-label={t('ariaLabel', { status: statusLabel })}>
      {/* status indicator */}
      <span>{statusLabel}</span>
    </a>
  );
}
```

## How Locale Detection Works

### 1. Automatic Locale Detection

The application automatically detects the user's preferred language from:

1. **Cookie** (`ELEVA_LOCALE`) - User's explicit preference
2. **URL Path** - Locale prefix (e.g., `/es/`, `/pt/`)
3. **Accept-Language Header** - Browser's language setting
4. **Country Detection** - For Portuguese users:
   - Portugal (`pt-PT`) → `pt`
   - Brazil (`pt-BR`) → `br`

### 2. Locale Switching

Users can manually change their language using the LanguageSwitcher component in the footer.

### 3. Server Component Locale Resolution

Server Components (like ServerStatus) automatically receive the correct locale from the Next.js App Router context.

```tsx
// No explicit locale parameter needed!
const t = await getTranslations('status');
// ✅ Automatically uses the current request's locale
```

## Adding New Translations

### Step 1: Add to English (Base Language)

Edit `messages/en.json`:

```json
{
  "status": {
    "allSystemsNormal": "All systems normal",
    "newStatusMessage": "Your new message"
  }
}
```

### Step 2: Add Translations for Other Languages

Update all language files:

**Spanish** (`messages/es.json`):

```json
{
  "status": {
    "newStatusMessage": "Tu nuevo mensaje"
  }
}
```

**Portuguese** (`messages/pt.json` and `messages/br.json`):

```json
{
  "status": {
    "newStatusMessage": "Sua nova mensagem"
  }
}
```

### Step 3: Use in Component

```tsx
const statusLabel = t('newStatusMessage');
```

## Best Practices

### 1. Translation Keys

- Use **camelCase** for translation keys
- Use **descriptive names** that indicate the content
- Group related translations under namespaces

✅ Good:

```json
{
  "status": {
    "allSystemsNormal": "...",
    "partialOutage": "..."
  }
}
```

❌ Bad:

```json
{
  "msg1": "...",
  "status_all_ok": "..."
}
```

### 2. Parameterized Messages

Use parameters for dynamic content:

```json
{
  "status": {
    "ariaLabel": "System Status: {status}"
  }
}
```

Usage:

```tsx
t('ariaLabel', { status: statusLabel });
```

### 3. Consistency

- Keep translations consistent across similar components
- Use the same terminology throughout the application
- Maintain a translation glossary

### 4. Testing

Test all language variants:

```bash
# Test English
curl http://localhost:3000/en

# Test Spanish
curl http://localhost:3000/es

# Test Portuguese (Portugal)
curl http://localhost:3000/pt

# Test Portuguese (Brazil)
curl http://localhost:3000/br
```

## Accessibility

### ARIA Labels

All status indicators include translated ARIA labels:

```tsx
aria-label={t('ariaLabel', { status: statusLabel })}
```

This ensures screen readers announce the status in the user's language:

- 🇬🇧 "System Status: All systems normal"
- 🇪🇸 "Estado del Sistema: Todos los sistemas normales"
- 🇵🇹 "Estado do Sistema: Todos os sistemas normais"
- 🇧🇷 "Status do Sistema: Todos os sistemas normais"

## Performance

### Server-Side Translation

- ✅ Translations are resolved on the **server**
- ✅ No client-side JavaScript for translations
- ✅ SEO-friendly (crawlers see translated content)
- ✅ Fast initial render

### Caching

- Status data cached for **180 seconds**
- Translations loaded once per request
- No additional client-side bundle size

## Troubleshooting

### Issue: Status not translated

**Problem**: Status shows English text on Spanish page

**Solution**:

1. Check that translations exist in `messages/es.json`
2. Verify namespace matches: `getTranslations('status')`
3. Check key spelling: `t('allSystemsNormal')`
4. Restart dev server after translation changes

### Issue: Missing translation warning

**Problem**: Console shows `[next-intl] Missing translation`

**Solution**:

1. Add the missing key to all language files
2. Ensure the key exists in the base language (en.json)
3. Check for typos in translation keys

### Issue: Wrong locale detected

**Problem**: User sees wrong language

**Solution**:

1. Check `ELEVA_LOCALE` cookie
2. Verify URL locale prefix
3. Check `Accept-Language` header
4. Use LanguageSwitcher to set explicit preference

## Future Enhancements

### Additional Languages

To add support for more languages:

1. Create new message file (e.g., `messages/fr.json`)
2. Add locale to `lib/i18n/routing.ts`
3. Update LanguageSwitcher options
4. Translate all status messages

### Status Page Integration

Future enhancement: Link status messages to detailed status page sections:

```tsx
<a href={`${statusPageUrl}#${statusKey}`}>{t(statusKey)}</a>
```

### Real-time Updates

Consider WebSocket or Server-Sent Events for real-time status updates across languages.

## References

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Server Components & i18n](https://next-intl-docs.vercel.app/docs/getting-started/app-router/with-i18n-routing)
- [BetterStack Integration](./betterstack.md)
