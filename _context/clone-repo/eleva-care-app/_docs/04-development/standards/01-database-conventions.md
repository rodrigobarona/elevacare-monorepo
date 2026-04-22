# Database Naming Conventions

## Current State and Future Direction

Our database currently has mixed naming conventions due to historical reasons. While we're working towards standardizing everything to `snake_case`, this is a gradual process to ensure data safety.

### Current Naming Patterns

1. **Table Names**
   - Standard: Use `snake_case` for new tables
   - Example: `payment_transfers`, `blocked_dates`
   - Legacy: Some tables use `camelCase` (e.g., `scheduleAvailabilities`)

2. **Column Names**
   - Standard: Use `snake_case` for new columns
   - Example: `created_at`, `updated_at`, `expert_clerk_user_id`
   - Legacy: Some columns use `camelCase` (e.g., `clerkUserId`, `startTime`)

3. **Primary Keys**
   - Use `id` as the standard primary key name
   - UUID or Serial depending on the use case

4. **Foreign Keys**
   - Standard: `resource_id` format (e.g., `user_id`, `event_id`)
   - Legacy: Some use `camelCase` (e.g., `scheduleId`)

5. **Timestamps**
   - Standard: `created_at`, `updated_at`
   - Legacy: Some use `createdAt`, `updatedAt`

### Migration Strategy

To maintain data integrity while moving towards consistent naming:

1. **New Tables**
   - Always use `snake_case` for both table and column names
   - Follow the standard naming patterns above

2. **Existing Tables**
   - Create migration plans for each table
   - Test thoroughly in staging environment
   - Ensure all related code is updated
   - Schedule migrations during low-traffic periods

3. **Priority Order**
   - Start with less critical tables
   - Coordinate with feature development
   - Document all changes thoroughly

### Examples

```sql
-- ✅ Good (New Standard)
CREATE TABLE expert_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ❌ Avoid (Legacy Pattern)
CREATE TABLE expertProfiles (
    id UUID PRIMARY KEY,
    userId UUID NOT NULL,
    firstName VARCHAR(255),
    lastName VARCHAR(255),
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);
```

## Future Migrations

The following tables will need migration in the future:

1. `scheduleAvailabilities` → `schedule_availabilities`
2. Mixed columns in `meetings` table
3. Mixed columns in `users` table
4. `schedulingSettings` → `scheduling_settings`

Each migration will:

1. Create new table with correct naming
2. Migrate data safely
3. Update foreign key constraints
4. Drop old table

These migrations will be planned and executed gradually to minimize risk.
