# Fumadocs Documentation Framework Implementation

**Status:** ✅ Implemented  
**Version:** fumadocs-ui ^14.7.6, fumadocs-core ^14.7.6, fumadocs-mdx ^10.5.5  
**Date:** January 2026  
**Author:** Development Team

---

## Overview

Eleva Care uses **Fumadocs** as its documentation framework, providing a premium, accessible, and AI-friendly documentation experience across four specialized portals:

- **Patient Help Center** (`/docs/patient`) - End-user documentation
- **Expert Resources** (`/docs/expert`) - Healthcare professional guides
- **Workspace Portal** (`/docs/workspace`) - Organization management
- **Developer API** (`/docs/developer`) - Integration documentation

### Why Fumadocs?

1. **Premium UI** - Beautiful, professional design out-of-the-box
2. **Type-Safe** - Full TypeScript support with Zod schema validation
3. **AI-Friendly** - Built-in LLM integration for better SEO and AI accessibility
4. **i18n Support** - Seamless multi-language documentation
5. **Performance** - Build-time compilation, zero runtime overhead
6. **Built-in Components** - Rich component library (Accordions, Tabs, Callouts, etc.)

---

## Architecture

### File Structure

```
eleva-care-app/
├── source.config.ts              # Fumadocs MDX configuration
├── src/
│   ├── app/
│   │   ├── docs/
│   │   │   ├── layout.tsx        # Root docs provider
│   │   │   ├── docs.css          # Fumadocs UI styles
│   │   │   ├── mdx-components.tsx # Docs-specific MDX components
│   │   │   ├── components/
│   │   │   │   ├── docs-provider.tsx  # Client provider with search
│   │   │   │   └── search-dialog.tsx  # Custom search with portal filtering
│   │   │   ├── [portal]/
│   │   │   │   ├── layout.tsx    # Portal-specific DocsLayout
│   │   │   │   └── [[...slug]]/
│   │   │   │       └── page.tsx  # Dynamic MDX page renderer
│   │   │   ├── llms-full.txt/
│   │   │   │   └── route.ts      # AI/LLM full docs dump
│   │   │   └── llms.mdx/
│   │   │       └── docs/[portal]/[[...slug]]/
│   │   │           └── route.ts  # AI/LLM individual page access
│   │   └── api/
│   │       └── search/
│   │           └── route.ts      # Orama search API
│   ├── content/
│   │   └── docs/
│   │       ├── patient/          # Patient documentation
│   │       │   ├── en/
│   │       │   │   ├── meta.json
│   │       │   │   ├── index.mdx
│   │       │   │   └── ...
│   │       │   └── pt/
│   │       ├── expert/           # Expert documentation
│   │       ├── workspace/        # Workspace documentation
│   │       └── developer/        # Developer documentation
│   ├── lib/
│   │   ├── source.ts             # Fumadocs source loaders
│   │   ├── fumadocs-i18n.ts      # i18n config & utilities
│   │   ├── get-llm-text.ts       # AI/LLM text generation
│   │   └── layout.shared.ts      # Shared DocsLayout options
│   └── mdx-components.tsx        # Headless MDX components (marketing)
└── .source/                      # Generated (gitignored)
```

### Multi-Portal Architecture

Each documentation portal has its own:
- **Source Loader** - Independent content management
- **Base URL** - Unique routing (`/docs/patient`, `/docs/expert`, etc.)
- **Page Tree** - Sidebar navigation structure
- **i18n Support** - Per-locale content (`en/`, `pt/`, `es/`, `pt-BR/`)

---

## Configuration

### 1. Source Configuration (`source.config.ts`)

```typescript
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

// Global MDX configuration
export default defineConfig({
  mdxOptions: {
    // Default plugins included:
    // - remarkImage: Image optimization
    // - remarkHeading: TOC generation
    // - remarkStructure: Search indexes
    // - remarkGfm: GitHub Flavored Markdown
    // - rehypeCode: Syntax highlighting
    // - rehypeToc: TOC export
  },
});

// Documentation collections
export const patient = defineDocs({
  dir: 'src/content/docs/patient',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true, // Enable for AI/LLM
    },
  },
});

export const expert = defineDocs({
  dir: 'src/content/docs/expert',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

// ... workspace, developer
```

### 2. Source Loaders (`src/lib/source.ts`)

```typescript
import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { patient, expert, workspace, developer } from 'fumadocs-mdx:collections/server';
import { i18n } from './fumadocs-i18n';

export const patientSource = loader({
  baseUrl: '/docs/patient',
  source: patient.toFumadocsSource(),
  i18n,
  plugins: [lucideIconsPlugin()],
});

// ... expertSource, workspaceSource, developerSource

export const portalSources = {
  patient: patientSource,
  expert: expertSource,
  workspace: workspaceSource,
  developer: developerSource,
} as const;

export type PortalKey = keyof typeof portalSources;

export function getPortalSource(portal: string) {
  return portalSources[portal as PortalKey];
}
```

### 3. Internationalization (`src/lib/fumadocs-i18n.ts`)

```typescript
import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'es', 'pt', 'pt-BR'],
  hideLocale: 'default-locale', // Hide /en/ prefix
  parser: 'dir', // Content in locale directories
});

// Shared with next-intl via NEXT_LOCALE cookie
export async function getFumadocsLocale(): Promise<FumadocsLanguage> {
  const cookieStore = await cookies();
  
  // Priority 1: FUMADOCS_LOCALE (explicit docs preference)
  const fumadocsLocale = cookieStore.get('FUMADOCS_LOCALE')?.value;
  if (fumadocsLocale && isValidFumadocsLocale(fumadocsLocale)) {
    return fumadocsLocale;
  }
  
  // Priority 2: x-fumadocs-locale header (proxy rewrite)
  const headerLocale = headers().get('x-fumadocs-locale');
  if (headerLocale && isValidFumadocsLocale(headerLocale)) {
    return headerLocale;
  }
  
  // Priority 3: NEXT_LOCALE (shared with next-intl)
  const nextLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (nextLocale && isValidFumadocsLocale(nextLocale)) {
    return nextLocale;
  }
  
  return i18n.defaultLanguage;
}
```

---

## AI/LLM Integration

### Full Documentation Dump

**Route:** `GET /llms-full.txt`  
**Purpose:** Provides all documentation in one text file for AI indexing

```typescript
// src/app/llms-full.txt/route.ts
export async function GET() {
  const allPages = [
    ...patientSource.getPages(),
    ...expertSource.getPages(),
    ...workspaceSource.getPages(),
    ...developerSource.getPages(),
  ];

  const scan = allPages.map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

### Individual Page Access

**Route:** `GET /docs/:portal/:path*.mdx`  
**Purpose:** AI agents can access specific pages as markdown

```typescript
// Rewrite rule in next.config.ts
async rewrites() {
  return [
    {
      source: '/docs/:portal/:path*.mdx',
      destination: '/llms.mdx/docs/:portal/:path*',
    },
  ];
}
```

### Content Negotiation

```typescript
// src/proxy.ts
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';

const { rewrite: rewriteLLM } = rewritePath('/docs{/*path}', '/llms.mdx/docs{/*path}');

export default async function proxy(request: NextRequest) {
  // If AI agent requests markdown via Accept header
  if (isMarkdownPreferred(request) && path.startsWith('/docs/')) {
    const result = rewriteLLM(path);
    if (result) {
      return NextResponse.rewrite(new URL(result, request.url));
    }
  }
  // ...
}
```

---

## MDX Content Guidelines

### File Structure

```
src/content/docs/patient/
├── en/
│   ├── meta.json         # Navigation structure
│   ├── index.mdx         # Landing page
│   ├── booking.mdx
│   ├── payments.mdx
│   └── faq.mdx
└── pt/                   # Portuguese translations
    ├── meta.json
    ├── index.mdx
    └── ...
```

### Meta.json Structure

```json
{
  "title": "Patient Help Center",
  "pages": [
    "index",
    {
      "title": "Getting Started",
      "icon": "BookOpen",
      "pages": [
        "booking",
        "payments"
      ]
    },
    "faq"
  ]
}
```

### MDX Frontmatter

```mdx
---
title: Booking Appointments
description: Learn how to book and manage appointments on Eleva Care
icon: Calendar
---

# Booking Appointments

Your content here...
```

### Component Usage

#### ✅ CORRECT - Proper Indentation

```mdx
<Tabs items={['Overview', 'Details']}>
  <Tab value="Overview">
    Content introduction here.

    - List item 1
    - List item 2
    - List item 3

  </Tab>
  <Tab value="Details">
    More detailed information.

    - Detail 1
    - Detail 2

  </Tab>
</Tabs>

<Accordions>
  <Accordion title="How does booking work?">
    Step-by-step explanation.

    1. First step
    2. Second step
    3. Third step

  </Accordion>
</Accordions>

<Steps>
  <Step>
    ### Create Account

    Sign up instructions.

    - Fill out the form
    - Verify your email

  </Step>
  <Step>
    ### Choose Expert

    Selection process.

  </Step>
</Steps>
```

#### ❌ INCORRECT - No Indentation

```mdx
<!-- DO NOT DO THIS -->
<Tab value="Overview">
Content here
- List item
</Tab>

<Accordion title="Question">
Answer text
- Point 1
- Point 2
</Accordion>
```

### Available Components

#### Built-in Fumadocs Components

- **`<Accordions>`/`<Accordion>`** - Collapsible Q&A sections
- **`<Tabs>`/`<Tab>`** - Tabbed content
- **`<Steps>`/`<Step>`** - Step-by-step guides
- **`<Cards>`/`<Card>`** - Link cards with icons
- **`<Callout>`** - Info, warning, error boxes
- **`<TypeTable>`** - API parameter tables
- **`<Files>`/`<File>`/`<Folder>`** - File tree visualization
- **`<ImageZoom>`** - Zoomable images

#### Usage Examples

```mdx
<Callout type="info" title="Important">
  Remember to verify your email address.
</Callout>

<Callout type="warn">
  Your appointment must be confirmed within 24 hours.
</Callout>

<Cards>
  <Card
    title="Book Appointment"
    href="/docs/patient/booking"
    icon="Calendar"
  />
  <Card
    title="Payment Methods"
    href="/docs/patient/payments"
    icon="CreditCard"
  />
</Cards>

<TypeTable
  type={{
    name: 'BookingOptions',
    entries: [
      {
        name: 'duration',
        type: 'number',
        description: 'Session duration in minutes',
        required: true,
      },
      {
        name: 'type',
        type: '"video" | "in-person"',
        description: 'Appointment type',
        required: false,
      },
    ],
  }}
/>
```

---

## Search Implementation

### Orama Search API

```typescript
// src/app/api/search/route.ts
import { createSearchAPI } from 'fumadocs-core/search/server';

const sources = [
  { source: patientSource, tag: 'patient' },
  { source: expertSource, tag: 'expert' },
  { source: workspaceSource, tag: 'workspace' },
  { source: developerSource, tag: 'developer' },
];

function buildUnifiedIndexes(): AdvancedIndex[] {
  const indexes: AdvancedIndex[] = [];
  
  for (const { source, tag } of sources) {
    const pages = source.getPages();
    for (const page of pages) {
      indexes.push({
        id: `${tag}:${page.url}`,
        title: page.data.title,
        description: page.data.description,
        url: page.url,
        structuredData: page.data.structuredData,
        tag,
      });
    }
  }
  
  return indexes;
}

export const { GET } = createSearchAPI('advanced', {
  indexes: buildUnifiedIndexes(),
  localeMap: {
    en: { language: 'english' },
    es: { language: 'spanish' },
    pt: { language: 'portuguese' },
    'pt-BR': { language: 'portuguese' },
  },
});
```

### Custom Search Dialog

```tsx
// src/app/docs/components/search-dialog.tsx
'use client';

import { useDocsSearch } from 'fumadocs-core/search/client';
import { SearchDialog, TagsList, TagsListItem } from 'fumadocs-ui/components/dialog/search';

export default function DocsSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string | undefined>();
  
  const { search, setSearch, query } = useDocsSearch({
    type: 'fetch',
    tag,
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} {...props}>
      <SearchDialogFooter>
        <TagsList tag={tag} onTagChange={setTag}>
          <TagsListItem value="patient">
            <Users className="size-3" />
            Patient
          </TagsListItem>
          <TagsListItem value="expert">
            <BookOpen className="size-3" />
            Expert
          </TagsListItem>
          {/* ... */}
        </TagsList>
      </SearchDialogFooter>
    </SearchDialog>
  );
}
```

---

## Routing & Middleware

### Dynamic Routes

```
/docs/patient              → Patient landing page
/docs/patient/booking      → Patient booking guide
/docs/expert/profile       → Expert profile setup
/pt/docs/patient           → Portuguese patient docs (via middleware)
/docs/patient/booking.mdx  → AI/LLM markdown access
```

### Middleware Integration

```typescript
// src/proxy.ts

// STEP 3: HANDLE LOCALE-PREFIXED DOCS ROUTES
const localeDocsMatch = path.match(/^\/(en|es|pt|pt-BR)\/docs(\/.*)?$/);
if (localeDocsMatch) {
  const locale = localeDocsMatch[1];
  const docsPath = `/docs${localeDocsMatch[2] || ''}`;
  
  const response = NextResponse.rewrite(new URL(docsPath, request.url));
  response.headers.set('x-fumadocs-locale', locale);
  response.cookies.set('FUMADOCS_LOCALE', locale, {
    path: '/docs',
    maxAge: 60 * 60 * 24 * 365,
  });
  
  return response;
}
```

### Route Configuration

```typescript
// src/app/(marketing)/[locale]/layout.tsx

/**
 * CRITICAL: Disable dynamic params to prevent route conflicts
 * 
 * Without this, `/docs/patient` would match as `[locale]=docs, [username]=patient`
 * instead of falling through to `app/docs/[portal]`.
 */
export const dynamicParams = false;
```

---

## Best Practices

### 1. Content Organization

- **One concept per page** - Keep pages focused
- **Progressive disclosure** - Start simple, add depth
- **Consistent structure** - Use same headings across pages
- **Cross-reference** - Link related content

### 2. Writing Style

- **Clear and concise** - Short sentences, active voice
- **User-focused** - Address the reader directly
- **Action-oriented** - Tell users what to do
- **Professional tone** - Premium, not casual

### 3. Component Usage

- **Use built-in components** - Tabs, Accordions, Callouts
- **Proper indentation** - 4 spaces for content inside JSX
- **Blank lines** - Before closing tags with lists
- **Semantic markup** - Use correct component for purpose

### 4. Accessibility

- **Alt text** - Describe all images
- **Heading hierarchy** - Logical structure (h1 → h2 → h3)
- **Keyboard navigation** - All interactive elements accessible
- **Color contrast** - Fumadocs UI handles this

### 5. Internationalization

- **Parallel structure** - Same pages in all languages
- **Cultural adaptation** - Not just translation
- **Date/currency formats** - Locale-specific
- **RTL support** - Future consideration

### 6. Performance

- **Image optimization** - Use `remarkImage` plugin
- **Code splitting** - Fumadocs handles automatically
- **Static generation** - All pages pre-rendered
- **Caching** - AI/LLM routes cached forever

---

## Troubleshooting

### Common Issues

#### 1. MDX Compilation Errors

**Problem:** `Expected closing tag </Tab>`

**Solution:** Indent content inside JSX components by 4 spaces:

```mdx
<Tab value="Example">
    Content must be indented

    - Lists too
    - Like this

</Tab>
```

#### 2. Page Not Found

**Problem:** Documentation page returns 404

**Solution:** Check:
- `meta.json` includes the page
- File exists in `src/content/docs/[portal]/[locale]/`
- No typos in filename or frontmatter

#### 3. Locale Not Working

**Problem:** Portuguese content shows English

**Solution:** Verify:
- Cookie `FUMADOCS_LOCALE` or `NEXT_LOCALE` is set
- Content exists in `/pt/` directory
- `getFumadocsLocale()` is called in layout

#### 4. Search Not Finding Pages

**Problem:** Search returns no results

**Solution:**
- Clear `.next` cache: `rm -rf .next`
- Restart dev server: `bun run dev`
- Check search API logs for indexing errors

---

## Migration Guide

### From Other Frameworks

#### Docusaurus → Fumadocs

1. **Content Structure:**
   - Move `docs/` to `src/content/docs/[portal]/en/`
   - Convert `sidebar.js` to `meta.json` files
   - Update frontmatter format

2. **Components:**
   - Replace `:::note` with `<Callout>`
   - Replace `<Tabs>` with Fumadocs `<Tabs>`
   - Custom components go in `mdx-components.tsx`

3. **Routing:**
   - Update all internal links
   - Set up locale redirects in middleware

#### GitBook → Fumadocs

1. **Export Content:**
   - Export as Markdown from GitBook
   - Organize into portal directories

2. **Navigation:**
   - Convert SUMMARY.md to `meta.json`
   - Add icons from Lucide

3. **Styling:**
   - Remove GitBook-specific classes
   - Use Fumadocs components

---

## Development Workflow

### Adding New Documentation

1. **Create MDX file:**
   ```bash
   touch src/content/docs/patient/en/new-page.mdx
   ```

2. **Add frontmatter:**
   ```mdx
   ---
   title: New Page Title
   description: Brief description for SEO
   icon: IconName
   ---
   ```

3. **Add to navigation:**
   ```json
   // src/content/docs/patient/en/meta.json
   {
     "pages": [
       "new-page"  // Add here
     ]
   }
   ```

4. **Write content:**
   - Use Fumadocs components
   - Follow indentation rules
   - Add i18n translations

5. **Test:**
   ```bash
   bun run dev
   # Visit http://localhost:3000/docs/patient/new-page
   ```

### Translating Content

1. **Copy English version:**
   ```bash
   cp src/content/docs/patient/en/page.mdx \
      src/content/docs/patient/pt/page.mdx
   ```

2. **Translate content:**
   - Preserve component structure
   - Adapt cultural references
   - Update `meta.json` titles

3. **Update locale files:**
   ```bash
   # Both files need updates
   src/content/docs/patient/en/meta.json
   src/content/docs/patient/pt/meta.json
   ```

---

## Testing

### Manual Testing

```bash
# Test all portals
open http://localhost:3000/docs/patient
open http://localhost:3000/docs/expert
open http://localhost:3000/docs/workspace
open http://localhost:3000/docs/developer

# Test i18n
open http://localhost:3000/pt/docs/patient
open http://localhost:3000/es/docs/expert

# Test AI/LLM endpoints
curl http://localhost:3000/llms-full.txt
curl http://localhost:3000/docs/patient/booking.mdx
```

### Build Testing

```bash
# Full production build
bun run build

# Check for MDX errors
bun run build 2>&1 | grep "Error evaluating"

# Verify static generation
bun run build && bun run start
```

---

## Performance Metrics

### Build Performance

- **~500 MDX pages:** ~30-45 seconds (Turbopack)
- **Search indexing:** ~2-3 seconds
- **AI/LLM generation:** Cached forever
- **Static generation:** All pages pre-rendered

### Runtime Performance

- **First Load JS:** ~150KB (Fumadocs UI)
- **Page Transitions:** < 100ms
- **Search Response:** < 200ms
- **Image Loading:** Optimized with `next/image`

---

## Resources

### Official Documentation

- [Fumadocs Documentation](https://fumadocs.vercel.app)
- [Fumadocs MDX](https://fumadocs.vercel.app/docs/mdx)
- [Fumadocs UI](https://fumadocs.vercel.app/docs/ui)
- [Search (Orama)](https://fumadocs.vercel.app/docs/headless/search/orama)
- [AI/LLM Integration](https://fumadocs.vercel.app/docs/integrations/llms)

### GitHub Repositories

- [fuma-nama/fumadocs](https://github.com/fuma-nama/fumadocs)
- [Eleva Care - Documentation](src/content/docs/)

### Community

- [Fumadocs Discord](https://discord.gg/fumadocs)
- [GitHub Discussions](https://github.com/fuma-nama/fumadocs/discussions)

---

## Changelog

### January 2026 - Initial Implementation

- ✅ Multi-portal architecture (patient, expert, workspace, developer)
- ✅ i18n support (en, es, pt, pt-BR)
- ✅ AI/LLM integration (`/llms-full.txt`, `*.mdx` routes)
- ✅ Orama search with tag filtering
- ✅ Custom search dialog with portal filters
- ✅ Route conflict resolution (`dynamicParams = false`)
- ✅ Shared locale detection with next-intl
- ✅ Comprehensive MDX component library

### Known Issues

- MDX indentation errors in some workspace docs (being fixed)
- Search UI needs visual polish
- Page actions (Copy MDX, View Options) not yet implemented

---

## Next Steps

### Short Term

- [ ] Fix remaining MDX syntax errors
- [ ] Add AI search dialog (Ask AI feature)
- [ ] Implement page actions (Copy button, GitHub link)
- [ ] Add more examples to developer docs

### Medium Term

- [ ] Video tutorials integration
- [ ] Interactive code playgrounds
- [ ] API reference auto-generation
- [ ] Advanced search filters

### Long Term

- [ ] User feedback widgets
- [ ] Analytics on popular pages
- [ ] A/B testing for content
- [ ] AI-powered content suggestions

---

**Last Updated:** January 14, 2026  
**Maintained By:** Eleva Care Development Team

