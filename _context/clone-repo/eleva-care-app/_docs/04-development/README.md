# Development Documentation

> **Development practices, coding standards, testing guidelines, and integration guides for Eleva Care**

## Overview

This section contains all development-related documentation including code standards, testing strategies, integration guides, and UI/UX patterns.

---

## Development Sections

### 1. Standards (`standards/`)

Code standards, conventions, and best practices.

- **Database Conventions**: Schema design and naming
- **Internationalization**: i18n implementation (EN, ES, PT, BR)
- **Server Actions**: Next.js 16 server actions patterns
- **Build Optimization**: Bundle size and performance
- **URL Structure**: `/legal/` vs `/trust/` architecture

📄 **Key Files:**

- [Database Conventions](./standards/01-database-conventions.md)
- [Internationalization](./standards/02-internationalization.md)
- [Server Actions](./standards/03-server-actions.md)
- [Bundle Optimization](./standards/04-bundle-optimization-report.md)
- [Build Optimization](./standards/05-build-optimization-guide.md)
- [Core Web Vitals Optimization](./standards/06-core-web-vitals-optimization.md)
- [Server Audit Feb 2026](./standards/07-server-audit-feb2026.md) -- Admin auth, user refactor, dependency cleanup
- [Sentry Observability](./standards/08-sentry-observability.md) -- API route instrumentation pattern

---

### 2. Testing (`testing/`)

Comprehensive testing guidelines and strategies.

- **Testing Overview**: Unit, integration, E2E testing
- **Webhook Testing**: Stripe webhook testing
- **Email Testing**: Email template testing
- **Test Coverage**: Coverage requirements and reporting

📄 **Key Files:**

- [Testing Guide](./testing/01-testing-guide.md)
- [Webhook Testing](./testing/02-webhook-testing.md)
- [Email Testing](./testing/03-email-testing-guide.md)
- [Testing Overview](./testing/04-testing-overview.md)

---

### 3. Integrations (`integrations/`)

Third-party service integration guides.

- **Stripe Identity**: Identity verification implementation
- **Stripe Payouts**: Expert payout system
- **Private Layout**: Dashboard layout patterns
- **Email Templates**: Email design and implementation

📄 **Key Files:**

- [Stripe Identity](./integrations/01-stripe-identity.md)
- [Stripe Payouts](./integrations/02-stripe-payouts.md)
- [Private Layout](./integrations/03-private-layout.md)
- [Email Templates](./integrations/04-email-templates.md)

---

### 4. UI/UX (`ui-ux/`)

User interface and user experience patterns.

- **Dashboard Forms**: Form design and validation
- **React Hook Form**: Form state management
- **TipTap Editor**: Rich text editor implementation with Markdown support
- **OG Image System**: Open Graph image generation

📄 **Key Files:**

- [Dashboard Forms Design](./ui-ux/01-dashboard-forms-design.md)
- [React Hook Form Fixes](./ui-ux/02-react-hook-form-fixes.md)
- [TipTap Editor Fixes](./ui-ux/03-tiptap-editor-fixes.md)
- [OG Image System](./ui-ux/04-og-image-system.md)
- [TipTap Markdown Implementation](./ui-ux/05-tiptap-markdown-implementation.md)
- [Dashboard Redesign](./ui-ux/06-dashboard-redesign.md) -- Role-aware dashboards with Stripe embedded components

---

## Development Guidelines

### Code Standards

**TypeScript**

- Strict mode enabled
- No `any` types (use `unknown` when needed)
- Explicit return types for functions
- Interface over type for object shapes

**React/Next.js 16**

- Server Components by default
- Client Components only when needed
- Async params/searchParams
- Server Actions for mutations
- Proper cache invalidation with `updateTag()`

**File Organization**

- Atomic Design pattern (atoms, molecules, organisms)
- Co-locate tests with components
- Barrel exports for cleaner imports
- Feature-based folder structure

### Naming Conventions

**Files**

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- API routes: `route.ts`
- Server Actions: `actions.ts`

**Variables**

- Constants: `SCREAMING_SNAKE_CASE`
- Functions: `camelCase`
- Components: `PascalCase`
- Types/Interfaces: `PascalCase`

### Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Tests are included and passing
- [ ] No linter errors or warnings
- [ ] Follows existing patterns
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Accessibility considerations
- [ ] Performance optimized
- [ ] Security reviewed

---

## Testing Strategy

### Testing Pyramid

```
       /\
      /E2E\      <- Few (Critical user flows)
     /------\
    /  INT   \   <- Some (API interactions)
   /----------\
  /    UNIT    \ <- Many (Business logic)
 /--------------\
```

### Coverage Requirements

- **Unit Tests**: > 80% coverage
- **Integration Tests**: All API routes
- **E2E Tests**: Critical user journeys

### Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test --testPathPattern=tests/unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

See [Testing Guide](./testing/01-testing-guide.md) for complete testing documentation.

---

## Development Workflow

### 1. Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Develop feature
pnpm dev

# 3. Write tests
pnpm test:watch

# 4. Commit changes
git commit -m "feat: add your feature"

# 5. Push and create PR
git push origin feature/your-feature-name
```

### 2. Code Review Process

1. **Create PR**: Include description, screenshots, testing notes
2. **Automated Checks**: Linting, type checking, tests run automatically
3. **Preview Deployment**: Vercel creates preview URL
4. **Team Review**: At least one approval required
5. **Merge**: Squash and merge to main
6. **Deploy**: Automatic deployment to production

### 3. Hot Fix Process

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-fix

# 2. Fix issue
# ... make changes ...

# 3. Test thoroughly
pnpm test

# 4. Fast-track review
# Minimal review for critical fixes

# 5. Deploy immediately
git push origin hotfix/critical-fix
```

---

## URL Structure

### Route Organization

**Public Routes** (`/legal/`)

- Terms of Service
- Privacy Policy
- Cookie Policy
- Expert Agreement
- Payment Policies

**Trust Routes** (`/trust/`)

- Security Practices
- Data Processing Agreement (DPA)
- Platform Reliability

**Private Routes** (`/dashboard/`)

- Expert dashboard
- Client dashboard
- Settings and profile

See [URL Structure Guide](./url-structure-guide.md) for complete routing documentation.

---

## Internationalization (i18n)

### Supported Languages

- **English (EN)**: Default
- **Spanish (ES)**: Spain
- **Portuguese (PT)**: Portugal
- **Brazilian Portuguese (BR)**: Brazil

### Translation Workflow

1. **Add keys**: Update `messages/en.json`
2. **Translate**: Add translations to ES, PT, BR
3. **Use hooks**: `useTranslations()` in components
4. **Test**: Verify all languages

```typescript
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('HomePage');
  return <h1>{t('title')}</h1>;
}
```

See [Internationalization Guide](./standards/02-internationalization.md) for details.

---

## Performance Optimization

### Key Metrics

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

### Optimization Techniques

**Server Components**

- Default to Server Components
- Fetch data at server level
- Reduce client bundle size

**Caching**

- Redis for expensive operations
- React.cache for request memoization
- Edge caching for static content

**Code Splitting**

- Dynamic imports for large components
- Route-based code splitting
- Lazy load below-the-fold content

**Images**

- Use `next/image` for optimization
- WebP format with fallbacks
- Responsive images with srcset

See [Build Optimization Guide](./standards/05-build-optimization-guide.md) for details.

---

## Security Best Practices

### Input Validation

- Validate all user inputs
- Use Zod for schema validation
- Sanitize HTML and SQL inputs
- Rate limit API endpoints

### Authentication & Authorization

- Use Clerk for authentication
- Implement role-based access control
- Protect API routes with auth middleware
- Validate session on every request

### Data Protection

- Encrypt sensitive data
- Use environment variables for secrets
- Never commit secrets to Git
- Implement audit logging

---

## Common Patterns

### Server Action Pattern

```typescript
'use server';

import { auth } from '@clerk/nextjs/server';
import { updateTag } from 'next/cache';

export async function updateProfile(data: ProfileData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Update database
  await db.update(profiles).set(data).where(eq(profiles.userId, userId));

  // Invalidate cache
  updateTag(`profile-${userId}`);

  return { success: true };
}
```

### Error Handling Pattern

```typescript
try {
  const result = await dangerousOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);

  // Log to monitoring
  posthog.capture('operation_failed', {
    error: error.message,
    userId: userId,
  });

  return { success: false, error: 'Operation failed' };
}
```

### Loading State Pattern

```typescript
export default async function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DataComponent />
    </Suspense>
  );
}

async function DataComponent() {
  const data = await fetchData();
  return <Display data={data} />;
}
```

---

## Tools & Scripts

### Development Scripts

```bash
# Development server
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format

# Database migrations
pnpm migrate

# Database studio
pnpm studio
```

### Quality Checks

```bash
# Run all quality checks
pnpm lint && pnpm type-check && pnpm test

# Format and fix
pnpm format && pnpm lint --fix
```

---

## Troubleshooting

### Common Development Issues

**TypeScript Errors**

- Run `pnpm type-check` for full errors
- Check `tsconfig.json` settings
- Verify import paths

**Build Failures**

- Clear `.next` directory
- Check environment variables
- Verify all dependencies installed

**Test Failures**

- Check test environment setup
- Verify mock data
- Review test logs

**Hot Reload Not Working**

- Restart dev server
- Clear browser cache
- Check file watcher limits

---

## Related Documentation

- **Core Systems**: [Core Systems Docs](../02-core-systems/README.md)
- **Infrastructure**: [Infrastructure Docs](../03-infrastructure/README.md)
- **Legal**: [Legal & Compliance](../06-legal/README.md)
- **Deployment**: [Deployment Guides](../08-deployment/README.md)

---

**Last Updated**: January 2025  
**Maintained By**: Engineering Team  
**Questions?** Post in #engineering Slack channel
