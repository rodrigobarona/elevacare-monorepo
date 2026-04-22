# 📚 Lib Folder Organization

## 🎯 Purpose

The `lib/` folder contains reusable utilities, services, and business logic used across the application. This folder follows Node.js best practices with clear module interfaces and logical grouping.

## 📁 Structure

```
lib/
├── analytics/          # Analytics and tracking utilities
├── auth/              # Authentication and authorization
│   ├── index.ts       # Public interface
│   ├── roles.ts       # Role definitions and checks
│   ├── roles.server.ts # Server-side role utilities
│   └── admin-middleware.ts
├── cache/             # Caching utilities and strategies
│   ├── index.ts       # Public interface (if present)
│   └── redis-error-boundary.ts
├── constants/         # Application constants
│   ├── index.ts       # Public interface
│   ├── notifications.ts
│   ├── payment-statuses.ts
│   ├── payment-transfers.ts
│   ├── roles.ts
│   ├── scheduling.ts
│   └── social-media.ts
├── db/               # Database utilities (if needed)
├── hooks/            # React hooks
│   ├── usePostHog.ts
│   ├── useRoleCheck.ts
│   └── useExpertSetup.ts
├── i18n/             # Internationalization utilities
│   ├── index.ts
│   ├── navigation.ts
│   ├── routing.ts
│   └── utils.ts
├── icons/            # Icon components
│   └── ServiceIcons.tsx
├── integrations/     # External service integrations
│   ├── betterstack/
│   │   ├── index.ts
│   │   └── heartbeat.ts
│   ├── dub/
│   │   ├── index.ts
│   │   └── client.ts
│   ├── google/
│   │   ├── index.ts
│   │   └── calendar.ts
│   ├── novu/
│   │   ├── index.ts
│   │   ├── email-service.ts
│   │   └── utils.ts
│   ├── qstash/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── config.ts
│   │   ├── schedules.ts
│   │   ├── signature-validator.ts
│   │   └── utils.ts
│   ├── workos/        # WorkOS authentication and RBAC
│   └── stripe/
│       ├── index.ts
│       ├── client.ts
│       ├── identity.ts
│       └── transfer-utils.ts
├── markdown/         # Markdown utilities
├── mdx/             # MDX utilities
│   └── server-mdx.tsx
├── notifications/    # Notification utilities
│   ├── index.ts
│   ├── core.ts
│   └── payment.ts
├── og-images/       # Open Graph image generation
├── redis/           # Redis-specific utilities
│   ├── index.ts
│   ├── manager.ts
│   └── cleanup.ts
├── seo/             # SEO utilities
│   └── metadata-utils.ts
├── utils/           # General utilities
│   ├── index.ts
│   ├── cache-keys.ts
│   ├── customerUtils.ts
│   ├── encryption.ts
│   ├── formatters.ts
│   ├── revalidation.ts
│   ├── server-utils.ts
│   └── users.ts
├── validations/     # Validation schemas
│   └── slug.ts
├── webhooks/        # Webhook utilities
│   ├── index.ts
│   └── health.ts
└── README.md        # This file
```

## 🔧 Usage Guidelines

### Import from Module Interfaces

Always import from the module's index file, not from specific files:

```typescript
// ✅ Good: Import from module interface
import { checkUserRole, ROLES } from '@/lib/auth';
import { CustomerCache, redisManager } from '@/lib/redis';
import { qstashClient, setupSchedules } from '@/lib/integrations/qstash';

// ❌ Bad: Import from specific files
import { checkUserRole } from '@/lib/auth/roles.server';
import { CustomerCache } from '@/lib/redis/manager';
```

### Module Organization Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Explicit Exports**: Use index.ts to control public API
3. **Logical Grouping**: Related utilities grouped by domain
4. **Clear Naming**: File names describe their content

### Adding New Utilities

1. Determine the appropriate category
2. Create the utility file in that folder
3. Export from the folder's index.ts
4. Update this README if adding a new category

## 📊 Module Usage Statistics

Top imported modules (sorted by frequency):

1. `utils` - General utilities (53 imports)
2. `integrations/stripe` - Stripe integration (15 imports)
3. `auth/roles.server` - Server-side auth (13 imports)
4. `i18n` - Internationalization (10 imports)
5. `cache` - Caching utilities (10 imports)

## 🔍 Finding Utilities

- **Authentication?** → `lib/auth/`
- **Caching?** → `lib/cache/` or `lib/redis/`
- **External API?** → `lib/integrations/[service]/`
- **Formatting/parsing?** → `lib/utils/`
- **Constants?** → `lib/constants/`
- **Notifications?** → `lib/notifications/`
- **Hooks?** → `lib/hooks/`

## 🚀 Migration Notes

This structure follows Node.js best practices from [Node.js Best Practices Guide](https://github.com/goldbergyoni/nodebestpractices):

- **Component-based structure**: Related code grouped by domain
- **Index.ts interfaces**: Clean public APIs
- **Separation of concerns**: Each module has a clear purpose
- **Easy refactoring**: Internal changes don't break external usage

## 📝 Maintenance

- **Regular audits**: Review unused files quarterly
- **Update index files**: When adding/removing exports
- **Document changes**: Update this README for new categories
- **Test imports**: Ensure all exports resolve correctly
