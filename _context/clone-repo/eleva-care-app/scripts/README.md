# Scripts Directory

This directory contains reusable utility scripts for the Eleva Care application.

## Directory Structure

```
scripts/
├── utilities/              # Reusable utility scripts
└── README.md              # This file
```

## Active Utility Scripts

### Cache Management

**`utilities/cache-manager.ts`** - Unified cache management utility

- Clear user cache by environment
- Check Redis health status
- View cache statistics
- Clear all cache entries

```bash
# Clear cache for development environment
bun scripts/utilities/cache-manager.ts clear-clerk --env=development

# Check Redis health
bun scripts/utilities/cache-manager.ts health

# View cache statistics
bun scripts/utilities/cache-manager.ts stats

# Clear all cache entries
bun scripts/utilities/cache-manager.ts clear-all
```

### QStash Management

**`utilities/qstash-manager.js`** - Manage QStash scheduled jobs

- Schedule all configured cron jobs
- List existing schedules
- Clean up old schedules
- Monitor schedule health

```bash
# Schedule all jobs
node scripts/utilities/qstash-manager.js schedule

# List all schedules
node scripts/utilities/qstash-manager.js list

# Show statistics
node scripts/utilities/qstash-manager.js stats

# Clean up old schedules
node scripts/utilities/qstash-manager.js cleanup
```

**`utilities/update-qstash-schedules.ts`** - Update QStash schedules using configuration

```bash
# Update all schedules based on config/qstash.ts
bun scripts/utilities/update-qstash-schedules.ts
```

### Health Checks

**`utilities/test-betterstack-health.sh`** - Test BetterStack health endpoint integration

```bash
bash scripts/utilities/test-betterstack-health.sh
```

**`utilities/test-health-endpoints.sh`** - Test all application health endpoints

```bash
bash scripts/utilities/test-health-endpoints.sh
```

### WorkOS RBAC Configuration

**`utilities/workos-rbac-config.ts`** - Manage WorkOS roles and permissions configuration

- Single source of truth for all roles and permissions
- Generate multiple formats (JSON, CSV, Markdown, TypeScript)
- Validate configuration integrity
- Export copy-paste friendly formats for WorkOS Dashboard

```bash
# Show configuration summary
bun scripts/utilities/workos-rbac-config.ts summary

# Validate configuration
bun scripts/utilities/workos-rbac-config.ts validate

# Generate all formats (JSON, CSV, Markdown, TypeScript)
bun scripts/utilities/workos-rbac-config.ts generate-all

# Generate specific format
bun scripts/utilities/workos-rbac-config.ts generate-json
bun scripts/utilities/workos-rbac-config.ts generate-csv
bun scripts/utilities/workos-rbac-config.ts generate-markdown
bun scripts/utilities/workos-rbac-config.ts generate-typescript
```

## Best Practices

### Creating New Scripts

1. **Determine if it's reusable or one-time:**
   - Reusable → Place in `utilities/` and document here
   - One-time → Create in root, run once, then **DELETE** (don't leave obsolete scripts)

2. **Follow naming conventions:**
   - Utilities: `<action>-<resource>.ts` (e.g., `cache-manager.ts`)
   - One-time: `<verb>-<what>.ts` (e.g., `fix-user-emails.ts`)

3. **Include documentation:**
   - Add header comment with purpose, usage, and examples
   - Update this README if it's a reusable utility

4. **Use TypeScript for Node.js scripts:**
   - Use `.ts` extension for TypeScript
   - Run with `bun scripts/<script-name>.ts`
   - Use `.js` only for legacy or pure Node scripts
   - Use `.sh` for shell scripts

5. **Clean up after yourself:**
   - One-time scripts should be deleted after use
   - Don't commit debugging or setup scripts
   - Keep only reusable utilities

### Running Scripts

**TypeScript scripts:**

```bash
bun scripts/utilities/<script-name>.ts
```

**JavaScript scripts:**

```bash
node scripts/utilities/<script-name>.js
```

**Shell scripts:**

```bash
bash scripts/utilities/<script-name>.sh
```

### Environment Variables

Most scripts require environment variables. Ensure your `.env` file is properly configured:

```env
# Required for Redis/Cache scripts
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Required for QStash scripts
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Required for health check scripts
NEXT_PUBLIC_APP_URL=https://...
BETTERSTACK_HEARTBEAT_URL=https://...
```

## Script Lifecycle

1. **Development** - Create script (reusable in `utilities/`, one-time in root)
2. **Testing** - Test thoroughly before running in production
3. **Execution** - Run the script as needed
4. **Cleanup** - If one-time use, **DELETE immediately after use**
5. **Documentation** - Update README only for reusable utilities

## Troubleshooting

### Script won't run

- Ensure all required environment variables are set
- Check file permissions (`chmod +x script-name.sh` for shell scripts)
- Verify dependencies are installed (`bun install`)

### Redis connection errors

- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Redis health: `bun scripts/utilities/cache-manager.ts health`

### QStash errors

- Verify `QSTASH_TOKEN` and signing keys are set in `.env`
- Test with: `bun scripts/utilities/update-qstash-schedules.ts`

### TypeScript errors

- Ensure `tsx` is installed: `bun add -D tsx`
- Check tsconfig.json is properly configured

## Contributing

When adding new scripts:

1. **For reusable utilities:**
   - Place in `utilities/` directory
   - Follow naming conventions
   - Include comprehensive documentation
   - Update this README
   - Test thoroughly before committing

2. **For one-time scripts:**
   - Create in root `scripts/` directory
   - Run and test
   - **DELETE after use** (don't commit unless needed for reference)
   - Document significant migrations in project docs if needed

## Related Documentation

- [Redis Implementation](../docs/02-core-systems/06-caching-redis.md)
- [QStash Integration](../docs/02-core-systems/11-qstash-integration.md)
- [Environment Variables](../docs/01-getting-started/02-environment-variables.md)
