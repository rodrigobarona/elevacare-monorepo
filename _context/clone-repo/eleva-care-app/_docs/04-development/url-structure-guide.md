# URL Structure Guide: `/legal/` vs `/trust/` Architecture

> **Complete guide to Eleva Care's dual URL structure for legal documents and trust/security content**

## 📋 Table of Contents

- [Overview](#overview)
- [URL Structure](#url-structure)
- [Migration Summary](#migration-summary)
- [Implementation Details](#implementation-details)
- [SEO & Redirects](#seo--redirects)
- [Development Guidelines](#development-guidelines)

---

## Overview

As of **October 2025**, Eleva Care uses a **hybrid URL structure** that separates trust/security content from legal documents. This architecture follows industry best practices for SaaS platforms and improves:

- **Marketing appeal** - `/trust/` conveys confidence and security
- **Content organization** - Clear separation between legal contracts and security practices
- **SEO optimization** - Better categorization for search engines
- **User experience** - Intuitive navigation for different content types

### Why the Change?

**Before**: All compliance, security, and legal content lived under `/legal/`
**After**: Trust/security content moved to `/trust/` for better positioning

This mirrors successful platforms like [Stripe](https://stripe.com/trust), [Vercel](https://vercel.com/trust), and [Cloudflare](https://www.cloudflare.com/trust-hub/).

---

## URL Structure

### `/trust/` - Trust Center (Security & Compliance)

**Purpose**: Public-facing security practices, compliance certifications, and data protection measures.

| URL               | Content                                                 | Status Code | Languages      |
| ----------------- | ------------------------------------------------------- | ----------- | -------------- |
| `/trust/security` | Security practices, certifications, compliance overview | 200         | EN, ES, PT, BR |
| `/trust/dpa`      | Data Processing Agreement (GDPR/LGPD)                   | 200         | EN, ES, PT, BR |

**Content Location**: `content/trust/`

**Routing**: `app/[locale]/(public)/trust/[document]/page.tsx`

**Target Audience**:

- Potential clients evaluating security
- Security teams performing audits
- Compliance officers
- Enterprise buyers

---

### `/legal/` - Legal Documents (Contracts & Policies)

**Purpose**: Legal agreements, terms, policies, and contractual obligations.

| URL                       | Content          | Status Code | Languages      |
| ------------------------- | ---------------- | ----------- | -------------- |
| `/legal/terms`            | Terms of Service | 200         | EN, ES, PT, BR |
| `/legal/privacy`          | Privacy Policy   | 200         | EN, ES, PT, BR |
| `/legal/cookie`           | Cookie Policy    | 200         | EN, ES, PT, BR |
| `/legal/payment-policies` | Payment Policies | 200         | EN, ES, PT, BR |
| `/legal/expert-agreement` | Expert Agreement | 200         | EN, ES, PT, BR |

**Content Location**: `content/` (individual folders)

**Routing**: `app/[locale]/(public)/legal/[document]/page.tsx`

**Target Audience**:

- Users accepting terms
- Legal departments
- Compliance reviews
- Support inquiries

---

## Migration Summary

### What Changed

#### Content Moved

```bash
# Before
content/security/      → content/trust/security/
content/dpa/           → content/trust/dpa/

# Unchanged
content/terms/         ✓ (remains)
content/privacy/       ✓ (remains)
content/cookie/        ✓ (remains)
```

#### Routing Added

```bash
# New routes
app/[locale]/(public)/trust/
├── layout.tsx         # Trust section layout
├── page.tsx           # Redirects to /trust/security
└── [document]/
    └── page.tsx       # Dynamic route for security & dpa
```

#### Configuration Updated

```typescript
// lib/i18n/routing.ts
export const routing = defineRouting({
  pathnames: {
    // ... existing paths
    '/trust': '/trust',
    '/trust/security': '/trust/security',
    '/trust/dpa': '/trust/dpa',
  },
});

// config/legal-agreements.ts
export const DPA_CONFIG = {
  documentPath: '/trust/dpa', // Changed from /legal/dpa
};
```

---

## Implementation Details

### 1. Middleware Redirects (SEO)

**File**: `middleware.ts`

```typescript
// Handle redirects from old /legal/ URLs to new /trust/ URLs for SEO
if (path.includes('/legal/security') || path.includes('/legal/dpa')) {
  const newPath = path
    .replace('/legal/security', '/trust/security')
    .replace('/legal/dpa', '/trust/dpa');
  console.log(`🔀 Redirecting old legal URL to trust: ${path} → ${newPath}`);
  return NextResponse.redirect(new URL(newPath, req.url), 301); // Permanent redirect
}
```

**Why Middleware?**

- ✅ Runs on the Edge (fast, ~5-10ms)
- ✅ Handles all locale prefixes automatically (`/en/legal/dpa` → `/en/trust/dpa`)
- ✅ Returns 301 (permanent) for SEO
- ✅ Combines with existing Clerk auth logic
- ✅ More maintainable than multiple `next.config.js` rules

**Alternative Considered**: `next.config.js` redirects

```javascript
// ❌ NOT USED - Would require many rules for each locale
module.exports = {
  async redirects() {
    return [
      { source: '/legal/security', destination: '/trust/security', permanent: true },
      { source: '/en/legal/security', destination: '/en/trust/security', permanent: true },
      { source: '/es/legal/security', destination: '/es/trust/security', permanent: true },
      // ... repeat for all locales and paths
    ];
  },
};
```

---

### 2. Sitemap Updates

**File**: `app/sitemap.ts`

```typescript
// Separated legal and trust documents
const legalDocuments = ['terms', 'privacy', 'cookie', 'payment-policies', 'expert-agreement'];
const trustDocuments = ['security', 'dpa'];

// Trust documents get higher priority (0.7 vs 0.6)
trustDocuments.forEach((document) => {
  const route = `/trust/${document}`;
  sitemapEntries.push({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7, // Higher than legal documents
    alternates: {
      languages: generateLanguageAlternates(route),
    },
  });
});
```

**SEO Impact**:

- ✅ Trust content ranked higher than legal (0.7 vs 0.6 priority)
- ✅ Proper alternate language links (hreflang)
- ✅ Separate categorization for search engines

---

### 3. Footer Navigation

**File**: `components/organisms/Footer.tsx`

```typescript
// Split navigation into two sections
<div>
  <h3>{t('nav.trust.title')}</h3> {/* Trust & Security */}
  <ul>
    <li><Link href="/trust/security">{t('nav.trust.security')}</Link></li>
    <li><Link href="/trust/dpa">{t('nav.trust.dpa')}</Link></li>
  </ul>

  <h3>{t('nav.legal.title')}</h3> {/* Legal */}
  <ul>
    <li><Link href="/legal/terms">{t('nav.legal.terms')}</Link></li>
    <li><Link href="/legal/privacy">{t('nav.legal.privacy')}</Link></li>
    {/* ... more legal links */}
  </ul>
</div>

// Compliance badges link to /trust/security
<Link href="/trust/security" aria-label={t('compliance.gdpr')}>
  <span>GDPR Compliant</span>
</Link>
```

---

### 4. Translations

**Files**: `messages/{en,es,pt,br}.json`

```json
{
  "metadata": {
    "trust": {
      "title": "Trust Center | Eleva Care",
      "description": "Learn about Eleva Care's security practices...",
      "documents": {
        "security": {
          "title": "Security & Compliance | Eleva Care",
          "description": "...GDPR, LGPD, and HIPAA compliance..."
        },
        "dpa": {
          "title": "Data Processing Agreement | Eleva Care",
          "description": "...how we handle and protect your data..."
        }
      }
    },
    "legal": {
      "title": "Legal Documentation | Eleva Care",
      "documents": {
        "terms": {
          /* ... */
        },
        "privacy": {
          /* ... */
        }
        // Note: security and dpa moved to trust section
      }
    }
  },
  "Footer": {
    "nav": {
      "trust": {
        "title": "Trust & Security",
        "security": "Security",
        "dpa": "Data Processing"
      },
      "legal": {
        "title": "Legal",
        "terms": "Terms of Service",
        "privacy": "Privacy Policy"
        // Note: security and dpa moved to trust section
      }
    }
  }
}
```

---

## SEO & Redirects

### Redirect Strategy

**Status Code**: `301 Moved Permanently`

- ✅ Tells search engines the move is permanent
- ✅ Transfers ~90-99% of link equity (SEO value)
- ✅ Browsers cache the redirect

**Coverage**:

```
/legal/security       → /trust/security       (301)
/legal/dpa           → /trust/dpa            (301)
/en/legal/security   → /en/trust/security    (301)
/es/legal/security   → /es/trust/security    (301)
/pt/legal/security   → /pt/trust/security    (301)
/pt-BR/legal/security → /pt-BR/trust/security (301)
(same for /dpa)
```

### Testing Redirects

```bash
# Test redirect behavior
curl -I https://eleva.care/legal/security
# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://eleva.care/trust/security

# Test with locale
curl -I https://eleva.care/es/legal/dpa
# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://eleva.care/es/trust/dpa
```

---

## Development Guidelines

### Adding New Trust Content

1. **Create MDX files** in `content/trust/{document}/`

   ```bash
   content/trust/
   └── new-document/
       ├── en.mdx
       ├── es.mdx
       ├── pt.mdx
       └── br.mdx
   ```

2. **Add to routing** in `lib/i18n/routing.ts`

   ```typescript
   pathnames: {
     // ...
     '/trust/new-document': '/trust/new-document',
   }
   ```

3. **Update valid documents** in `app/[locale]/(public)/trust/[document]/page.tsx`

   ```typescript
   const validDocuments = ['dpa', 'security', 'new-document'];
   ```

4. **Add translations** in `messages/{lang}.json`

   ```json
   {
     "metadata": {
       "trust": {
         "documents": {
           "new-document": {
             "title": "New Document | Eleva Care",
             "description": "..."
           }
         }
       }
     }
   }
   ```

5. **Update sitemap** in `app/sitemap.ts`
   ```typescript
   const trustDocuments = ['security', 'dpa', 'new-document'];
   ```

---

### Adding New Legal Content

Follow the same process but use:

- Location: `content/{document}/`
- Routing: `app/[locale]/(public)/legal/[document]/page.tsx`
- Array: `const validDocuments = ['terms', 'privacy', ..., 'new-document'];`

---

### Internal Linking

**✅ Correct**:

```markdown
<!-- In MDX files -->

See our [Security practices](/trust/security) for details.
Review our [Data Processing Agreement](/trust/dpa).
Read our [Terms of Service](/legal/terms).

<!-- The locale prefix is added automatically -->
```

**❌ Incorrect**:

```markdown
<!-- Don't hardcode locales -->

See our [Security](/en/trust/security) <!-- ❌ -->
See our [Security](/trust/security) <!-- ✅ -->
```

---

### Cross-References Between Sections

**Trust → Legal**:

```markdown
<!-- content/trust/security/en.mdx -->

For user rights and data collection details, see our [Privacy Policy](/legal/privacy).
```

**Legal → Trust**:

```markdown
<!-- content/privacy/en.mdx -->

Learn more about our [security measures](/trust/security) and
[data processing practices](/trust/dpa).
```

---

## Files Modified

### Content Files

- ✅ Moved `content/security/` → `content/trust/security/`
- ✅ Moved `content/dpa/` → `content/trust/dpa/`
- ✅ Updated cross-links in all MDX files (EN, ES, PT, BR)

### Routing Files

- ✅ Created `app/[locale]/(public)/trust/layout.tsx`
- ✅ Created `app/[locale]/(public)/trust/page.tsx`
- ✅ Created `app/[locale]/(public)/trust/[document]/page.tsx`
- ✅ Updated `app/[locale]/(public)/legal/[document]/page.tsx` (removed security, dpa)

### Configuration Files

- ✅ Updated `lib/i18n/routing.ts` (added `/trust/` paths)
- ✅ Updated `config/legal-agreements.ts` (DPA path)
- ✅ Updated `middleware.ts` (301 redirects)
- ✅ Updated `app/sitemap.ts` (separated legal/trust)

### UI Components

- ✅ Updated `components/organisms/Footer.tsx` (split navigation)
- ✅ Updated `app/(private)/account/identity/identity-client.tsx` (DPA link)

### Translations

- ✅ Updated `messages/en.json`
- ✅ Updated `messages/es.json`
- ✅ Updated `messages/pt.json`
- ✅ Updated `messages/br.json`

### Documentation

- ✅ Updated `docs/06-legal/README.md`
- ✅ Updated `docs/06-legal/compliance/*.md`
- ✅ Updated `docs/legal/SIGNUP_LEGAL_TERMS_REVIEW.md`

---

## Testing Checklist

### URL Access

- [ ] `/trust/security` loads in all languages
- [ ] `/trust/dpa` loads in all languages
- [ ] `/legal/terms` still works (unchanged)
- [ ] `/legal/privacy` still works (unchanged)

### Redirects

- [ ] `/legal/security` redirects to `/trust/security` (301)
- [ ] `/legal/dpa` redirects to `/trust/dpa` (301)
- [ ] Redirects work with locale prefixes (`/en/legal/security`, etc.)

### Navigation

- [ ] Footer shows separate "Trust & Security" and "Legal" sections
- [ ] All links point to correct URLs
- [ ] Compliance badges link to `/trust/security`

### SEO

- [ ] Sitemap includes `/trust/security` and `/trust/dpa`
- [ ] Trust documents have priority 0.7
- [ ] Legal documents have priority 0.6
- [ ] All documents have language alternates

### Translations

- [ ] All languages have trust navigation labels
- [ ] All languages have trust metadata
- [ ] Cross-links work in all languages

---

## Performance Impact

### Before

- All documents under `/legal/` with uniform priority

### After

- ✅ Trust content prioritized (0.7 vs 0.6)
- ✅ Better semantic categorization for search engines
- ✅ Edge redirects (5-10ms overhead for old URLs)
- ✅ Improved user trust perception

---

## Rollback Plan

If needed, the migration can be reversed:

1. **Move content back**:

   ```bash
   content/trust/security/ → content/security/
   content/trust/dpa/ → content/dpa/
   ```

2. **Update middleware** (change redirect direction):

   ```typescript
   if (path.includes('/trust/security') || path.includes('/trust/dpa')) {
     const newPath = path
       .replace('/trust/security', '/legal/security')
       .replace('/trust/dpa', '/legal/dpa');
     return NextResponse.redirect(new URL(newPath, req.url), 301);
   }
   ```

3. **Revert all other changes** using git:
   ```bash
   git revert <migration-commit-hash>
   ```

---

## Related Documentation

- [Internationalization Guide](./standards/02-internationalization.md)
- [Legal Compliance Summary](../06-legal/compliance/01-legal-compliance-summary.md)
- [Platform Clarity Updates](../06-legal/platform/03-platform-clarity-updates.md)
- [Next.js Routing Documentation](https://nextjs.org/docs/app/building-your-application/routing)

---

## Questions & Support

**Technical Questions**: Review middleware.ts and routing files
**Content Questions**: Check content/trust/ and content/ directories
**SEO Concerns**: Review sitemap.ts and redirect status codes
**Translation Issues**: Check messages/{lang}.json files

---

**Last Updated**: October 2025
**Migration Date**: October 2025
**Status**: ✅ Complete & Production-Ready
